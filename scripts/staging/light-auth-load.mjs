import process from 'node:process';

const [baseUrl, mode] = process.argv.slice(2);
const cookie = process.env.QA_COOKIE?.trim();
const levels = [10, 25, 50];

if (!baseUrl || !['dashboard', 'admin-before', 'admin-bootstrap'].includes(mode) || !cookie) {
  throw new Error('Usage: QA_COOKIE=<cookie> node light-auth-load.mjs <base-url> <dashboard|admin-before|admin-bootstrap>');
}

function percentile(values, percent) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return Number(sorted[Math.ceil(percent * sorted.length) - 1].toFixed(1));
}

async function request(path) {
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, baseUrl), {
      headers: { cookie, 'user-agent': 'isaudi-phase5f-light-qa' },
      redirect: 'manual',
    });
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      error1102: response.status === 1102 || /error\s*1102/i.test(body),
      d1Error: /\bD1(?:Database)?Error\b|database unavailable|تعذر.*قاعدة البيانات/i.test(body),
      elapsedMs: performance.now() - started,
      requests: 1,
    };
  } catch {
    return { ok: false, status: 0, error1102: false, d1Error: false, elapsedMs: performance.now() - started, requests: 1 };
  }
}

async function scenario() {
  if (mode === 'dashboard') return request('/dashboard');
  if (mode === 'admin-bootstrap') return request('/admin/api/bootstrap');
  const status = await request('/admin/api/status');
  if (!status.ok) return status;
  const data = await request('/admin/api/data');
  return {
    ok: data.ok,
    status: data.status,
    error1102: status.error1102 || data.error1102,
    d1Error: status.d1Error || data.d1Error,
    elapsedMs: status.elapsedMs + data.elapsedMs,
    requests: 2,
  };
}

const results = [];
for (const concurrency of levels) {
  const batchStarted = performance.now();
  const batch = await Promise.all(Array.from({ length: concurrency }, scenario));
  const batchElapsedMs = performance.now() - batchStarted;
  const latencies = batch.map((entry) => entry.elapsedMs);
  const success = batch.filter((entry) => entry.ok).length;
  const errors503 = batch.filter((entry) => entry.status === 503).length;
  const errors1102 = batch.filter((entry) => entry.error1102).length;
  const d1Errors = batch.filter((entry) => entry.d1Error).length;
  const requestCount = batch.reduce((total, entry) => total + entry.requests, 0);
  results.push({
    concurrency,
    requests: requestCount,
    rps: Number((requestCount * 1_000 / batchElapsedMs).toFixed(1)),
    successRate: Number((success * 100 / batch.length).toFixed(1)),
    errors503,
    errors1102,
    d1Errors,
    p50Ms: percentile(latencies, 0.5),
    p97_5Ms: percentile(latencies, 0.975),
    p99Ms: percentile(latencies, 0.99),
  });
  if (errors1102 > 0 || errors503 >= 2) break;
}

console.log(JSON.stringify({ mode, results }, null, 2));
