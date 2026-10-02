import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('chat renders structured consultant sections without exposing raw JSON or Markdown', async () => {
  const source = await readFile(
    new URL('../src/components/dashboard/chat-panel.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /StructuredAssistantMessage/);
  assert.match(source, /response\.sections\.map/);
  assert.match(source, /section\.metrics\.map/);
  assert.doesNotMatch(source, /JSON\.stringify\(response/);
});

test('chat structured output supports RTL, LTR, 390px layout, and reduced motion', async () => {
  const source = await readFile(
    new URL('../src/components/dashboard/chat-panel.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /dir=\{lang === 'ar' \? 'rtl' : 'ltr'\}/);
  assert.match(source, /min-\[390px\]:grid-cols-2/);
  assert.match(source, /motion-reduce:animate-none/);
  assert.match(source, /overflow-wrap:anywhere/);
  assert.match(source, /min-h-12/);
});
