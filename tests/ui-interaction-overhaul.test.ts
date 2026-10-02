import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('dashboard interactions are backed by real loaded data and expose accessible state', async () => {
  const source = await readFile(
    new URL('../src/app/(authenticated)/dashboard/dashboard-client.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const \[trendWindow, setTrendWindow\]/);
  assert.match(source, /const visibleTrend = trend\.slice\(0, trendWindow\)/);
  assert.match(source, /aria-pressed=\{trendWindow === weeks\}/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /id="dashboard-kpi-detail"/);
  assert.match(source, /parsedReport\.top_products/);
  assert.match(source, /parsedReport\.weak_products/);
  assert.match(source, /<details key=\{`\$\{name\}-\$\{index\}`\}/);
  assert.doesNotMatch(source, /mockStoreSelector|fakeProductAction|setInterval\(/);
});

test('AI consultant uses real suggested prompts, loading state, and expandable structured evidence', async () => {
  const source = await readFile(
    new URL('../src/components/dashboard/chat-panel.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /onClick=\{\(\) => setInput\(suggestion\)\}/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-label=\{lang === 'ar' \? 'المساعد يجهز الإجابة'/);
  assert.match(source, /<details[\s\S]*section\.metrics\.map/);
  assert.match(source, /group-open:rotate-180/);
  assert.doesNotMatch(source, /JSON\.stringify\(response/);
});

test('shared premium surfaces retain focus and reduced-motion safeguards', async () => {
  const [styles, shell, admin] = await Promise.all([
    readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/layout/authenticated-shell.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/admin/portal.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(styles, /\.isaudi-sidebar/);
  assert.match(styles, /\.isaudi-inset-panel/);
  assert.match(styles, /\.isaudi-primary-action/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(shell, /aria-current=\{active \? "page"/);
  assert.match(admin, /aria-pressed=\{tab === id\}/);
  assert.match(admin, /aria-expanded=\{menu\}/);
});
