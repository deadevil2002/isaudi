import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const srcRoot = fileURLToPath(new URL('../src', import.meta.url));

function sourceFiles(path: string): string[] {
  return readdirSync(path).flatMap(entry => {
    const target = join(path, entry);
    return statSync(target).isDirectory() ? sourceFiles(target) : /\.[jt]sx?$/.test(entry) ? [target] : [];
  });
}

test('application source contains no browser-native alert, confirm, or prompt calls', () => {
  const offenders = sourceFiles(srcRoot).flatMap(path => {
    const source = readFileSync(path, 'utf8');
    return /(?:\bwindow\s*\.\s*)?\b(?:alert|confirm|prompt)\s*\(/.test(source) ? [path] : [];
  });
  assert.deepEqual(offenders, []);
});

test('shared iSaudi dialog covers semantic variants and accessible modal behavior', () => {
  const dialog = readFileSync(new URL('../src/components/ui/app-dialog.tsx', import.meta.url), 'utf8');
  for (const variant of ['info', 'warning', 'success', 'error', 'confirm', 'destructive']) {
    assert.match(dialog, new RegExp(`\\b${variant}:`));
  }
  assert.match(dialog, /"dialog" : "alertdialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /aria-labelledby=/);
  assert.match(dialog, /aria-describedby=/);
  assert.match(dialog, /showModal\(\)/);
  assert.match(dialog, /onCancel=/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /querySelectorAll<HTMLElement>/);
  assert.match(dialog, /event\.preventDefault\(\);\s*last\.focus\(\)/);
  assert.match(dialog, /event\.preventDefault\(\);\s*first\.focus\(\)/);
  assert.match(dialog, /returnFocusRef\.current\?\.focus\(\)/);
  assert.match(dialog, /motion-reduce:open:animate-none/);
  assert.match(dialog, /dir=\{direction\}/);
});

test('destructive API-key and admin-video actions use the shared dialog while billing errors avoid native alerts', () => {
  const api = readFileSync(new URL('../src/app/(authenticated)/settings/api-access-panel.tsx', import.meta.url), 'utf8');
  const video = readFileSync(new URL('../src/app/admin/video-manager.tsx', import.meta.url), 'utf8');
  const billing = readFileSync(new URL('../src/app/(authenticated)/billing/billing-client.tsx', import.meta.url), 'utf8');
  assert.match(api, /variant=\{pendingAction\?\.type === "revoke" \? "destructive" : "warning"\}/);
  assert.match(video, /variant="destructive"/);
  assert.match(billing, /variant="error"/);
  assert.doesNotMatch(`${api}\n${video}\n${billing}`, /(?:\bwindow\s*\.\s*)?\b(?:alert|confirm|prompt)\s*\(/);
});
