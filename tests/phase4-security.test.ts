import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  InvalidCsvUploadError,
  csvRecord,
  decodeCsv,
  neutralizeSpreadsheetFormula,
  parseCsvText,
  validateCsvFileMetadata,
  validateCsvTable,
} from '../src/lib/security/csv-upload';

test('CSV upload rejects unsafe names, mismatched MIME, and binary content', () => {
  assert.throws(() => validateCsvFileMetadata('orders.csv.exe', 'text/csv'), InvalidCsvUploadError);
  assert.throws(() => validateCsvFileMetadata('orders.csv', 'image/png'), InvalidCsvUploadError);
  assert.throws(() => decodeCsv(new Uint8Array([0xff, 0xfe, 0x00])), InvalidCsvUploadError);
  assert.doesNotThrow(() => validateCsvFileMetadata('orders.csv', 'text/csv'));
});

test('CSV upload rejects malformed shapes and prototype headers', () => {
  assert.throws(
    () => validateCsvTable([['name', '__proto__'], ['safe', 'value']], 0),
    InvalidCsvUploadError
  );
  assert.throws(
    () => validateCsvTable([['name', 'price'], ['only-one']], 0),
    InvalidCsvUploadError
  );
  assert.throws(() => parseCsvText('name,price\n\"unterminated'), InvalidCsvUploadError);
});

test('CSV formula cells are neutralized and records have no prototype', () => {
  for (const value of ['=1+1', '+cmd', '-2+3', '@SUM(A1:A2)']) {
    assert.equal(neutralizeSpreadsheetFormula(value).startsWith("'"), true);
  }
  const record = csvRecord(['name'], ['safe']);
  assert.equal(Object.getPrototypeOf(record), null);
  assert.equal(record.name, 'safe');
});

test('Tap and Salla callback origins are pinned in production', async () => {
  const tap = await readFile(
    new URL('../src/app/api/billing/tap/create-payment/route.ts', import.meta.url),
    'utf8'
  );
  const salla = await readFile(
    new URL('../src/app/api/connect/salla/callback/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(tap, /https:\/\/isaudi\.ai\/billing\?status=processed/);
  assert.doesNotMatch(tap, /x-forwarded-host|headers\.get\('host'\)/);
  assert.match(salla, /process\.env\.NODE_ENV === 'production'[\s\S]*https:\/\/isaudi\.ai/);
});

test('sensitive routes are no-store and forwarded headers are not trusted', async () => {
  const middleware = await readFile(new URL('../src/middleware.ts', import.meta.url), 'utf8');
  assert.match(middleware, /private, no-store/);
  assert.match(middleware, /pathname\.startsWith\('\/api\/'\)/);
  assert.doesNotMatch(middleware, /x-forwarded-host|x-forwarded-proto/);
});

test('deployed source contains no debug or plan-escalation route handlers', async () => {
  for (const path of [
    '../src/app/api/debug/env/route.ts',
    '../src/app/api/debug/resend-ping/route.ts',
    '../src/app/api/debug/email-normalize/route.ts',
    '../src/app/api/dev/set-plan/route.ts',
  ]) {
    await assert.rejects(() => readFile(new URL(path, import.meta.url), 'utf8'));
  }
});

test('managed video uses direct signed Stream playback and super-admin authorization', async () => {
  const stream = await readFile(new URL('../src/lib/video/stream.ts', import.meta.url), 'utf8');
  const admin = await readFile(new URL('../src/app/admin/api/[action]/route.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../migrations/0014_how_it_works_video.sql', import.meta.url), 'utf8');
  assert.match(stream, /direct_upload/);
  assert.match(stream, /requireSignedURLs:\s*true/);
  assert.match(stream, /allowedOrigins/);
  assert.match(stream, /\/token/);
  assert.match(admin, /admin\.role !== 'super_admin'/);
  assert.match(admin, /how_it_works_video_upload_requested/);
  assert.match(admin, /how_it_works_video_removed/);
  assert.doesNotMatch(migration, /BLOB/i);
});

test('Stream CSP allowlist is narrow and preserves Saudi Business Center', async () => {
  const config = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.match(config, /connect-src[^\n]+\*\.videodelivery\.net[^\n]+\*\.cloudflarestream\.com/);
  assert.match(config, /frame-src[^\n]+eauthenticate\.saudibusiness\.gov\.sa[^\n]+\*\.cloudflarestream\.com/);
});
