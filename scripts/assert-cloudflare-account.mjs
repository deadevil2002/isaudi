import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const EXPECTED_ACCOUNT_ID = 'e8ae8afc6a6708283d6b0b4534f7c91f';
const EXPECTED_PROFILE = 'isaudi';
const EXPECTED_ZONE = 'isaudi.ai';
const EXPECTED_STAGING_URL = 'https://isaudi-staging.isaudi-official.workers.dev';
const EXPECTED_PRODUCTION_D1_ID = '9e19c212-0118-4660-aaeb-e46cc7f4470e';
const EXPECTED_STAGING_D1_ID = '48ad8f80-6aae-4147-84e5-9f88161401eb';
const MODES = new Set(['production', 'staging-create', 'staging-deploy', 'staging']);

function fail(message) {
  throw new Error(`Cloudflare account preflight failed: ${message}`);
}

function exactValue(source, key) {
  const matches = [...source.matchAll(new RegExp(`^${key}\\s*=\\s*"([^"]+)"\\s*$`, 'gm'))];
  if (matches.length !== 1) fail(`expected exactly one ${key} value, found ${matches.length}`);
  return matches[0][1];
}

function d1Binding(source) {
  const section = source.match(/\[\[d1_databases\]\]([\s\S]*?)(?=\n\[|$)/);
  if (!section) fail('D1 binding is missing');
  return {
    name: exactValue(section[1], 'database_name'),
    id: exactValue(section[1], 'database_id'),
  };
}

function loadConfig(path) {
  const source = readFileSync(path, 'utf8');
  return {
    accountId: exactValue(source, 'account_id'),
    worker: exactValue(source, 'name'),
    d1: d1Binding(source),
    appUrl: exactValue(source, 'APP_URL'),
    baseUrl: exactValue(source, 'BASE_URL'),
    publicAppUrl: exactValue(source, 'NEXT_PUBLIC_APP_URL'),
  };
}

function getToken() {
  const environmentToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (environmentToken) return environmentToken;

  const profile = process.env.CLOUDFLARE_PROFILE?.trim() || EXPECTED_PROFILE;
  const raw = execFileSync(
    process.execPath,
    ['./node_modules/wrangler/bin/wrangler.js', 'auth', 'token', '--profile', profile, '--json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const parsed = JSON.parse(raw);
  if (!parsed.token) fail(`Wrangler profile ${profile} did not return a token`);
  return parsed.token;
}

async function cloudflare(path, token) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const errors = payload.errors?.map((error) => error.message).join('; ') || response.statusText;
    fail(`Cloudflare API ${path} returned ${response.status}: ${errors}`);
  }
  return payload.result;
}

function exactlyOne(items, predicate, label) {
  const matches = items.filter(predicate);
  if (matches.length !== 1) fail(`expected exactly one ${label}, found ${matches.length}`);
  return matches[0];
}

async function main() {
  const mode = process.argv[2];
  if (!MODES.has(mode)) fail(`mode must be one of: ${[...MODES].join(', ')}`);
  const profile = process.env.CLOUDFLARE_PROFILE?.trim() || EXPECTED_PROFILE;
  if (profile !== EXPECTED_PROFILE) fail(`Wrangler profile is ${profile}, not ${EXPECTED_PROFILE}`);
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID !== EXPECTED_ACCOUNT_ID) {
    fail(`CLOUDFLARE_ACCOUNT_ID is ${process.env.CLOUDFLARE_ACCOUNT_ID}, not ${EXPECTED_ACCOUNT_ID}`);
  }

  const production = mode === 'production';
  const configPath = production ? './wrangler.toml' : './wrangler.staging.toml';
  const expectedWorker = production ? 'isaudi' : 'isaudi-staging';
  const expectedD1Name = production ? 'isaudi-db' : 'isaudi-staging-db';
  const expectedD1Id = production ? EXPECTED_PRODUCTION_D1_ID : EXPECTED_STAGING_D1_ID;
  const config = loadConfig(configPath);

  if (config.accountId !== EXPECTED_ACCOUNT_ID) fail(`${configPath} account_id mismatch`);
  if (config.worker !== expectedWorker) fail(`${configPath} Worker must be ${expectedWorker}`);
  if (config.d1.name !== expectedD1Name) fail(`${configPath} D1 must be ${expectedD1Name}`);
  if (expectedD1Id && config.d1.id !== expectedD1Id) fail(`${configPath} D1 ID mismatch`);
  if (!production) {
    for (const [key, value] of Object.entries({ APP_URL: config.appUrl, BASE_URL: config.baseUrl, NEXT_PUBLIC_APP_URL: config.publicAppUrl })) {
      if (value !== EXPECTED_STAGING_URL) fail(`${configPath} ${key} must be ${EXPECTED_STAGING_URL}`);
    }
  }

  const token = getToken();
  const account = await cloudflare(`/accounts/${EXPECTED_ACCOUNT_ID}`, token);
  if (account.id !== EXPECTED_ACCOUNT_ID) fail('authenticated account response does not match the pinned account');

  const [databases, workers] = await Promise.all([
    cloudflare(`/accounts/${EXPECTED_ACCOUNT_ID}/d1/database?per_page=100`, token),
    cloudflare(`/accounts/${EXPECTED_ACCOUNT_ID}/workers/scripts`, token),
  ]);
  const matchingDatabases = databases.filter((database) => database.name === expectedD1Name);
  const matchingWorkers = workers.filter((worker) => worker.id === expectedWorker);

  if (mode === 'staging-create') {
    if (matchingDatabases.length !== 0) fail(`${expectedD1Name} already exists in the pinned account`);
    if (matchingWorkers.length !== 0) fail(`${expectedWorker} already exists in the pinned account`);
  } else {
    const database = exactlyOne(matchingDatabases, () => true, `D1 database named ${expectedD1Name}`);
    if (database.uuid !== config.d1.id) fail(`${expectedD1Name} ID ${database.uuid} does not match config ID ${config.d1.id}`);
    if (production || mode === 'staging') exactlyOne(matchingWorkers, () => true, `Worker named ${expectedWorker}`);
    if (mode === 'staging-deploy' && matchingWorkers.length > 1) fail(`found duplicate ${expectedWorker} Workers`);
  }

  if (production) {
    const zones = await cloudflare(`/zones?name=${encodeURIComponent(EXPECTED_ZONE)}&account.id=${EXPECTED_ACCOUNT_ID}`, token);
    const zone = exactlyOne(zones, (item) => item.name === EXPECTED_ZONE && item.account?.id === EXPECTED_ACCOUNT_ID, `zone ${EXPECTED_ZONE}`);
    if (zone.status !== 'active') fail(`${EXPECTED_ZONE} is not active`);
  }

  console.log(`Cloudflare preflight passed: mode=${mode} account=${EXPECTED_ACCOUNT_ID} worker=${expectedWorker} d1=${expectedD1Name}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
