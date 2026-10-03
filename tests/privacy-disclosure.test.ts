import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { sharedIntelligenceAiMode } from '../src/lib/ai/shared-intelligence';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('public Privacy Notice discloses the actual aggregate purpose in Arabic and English', () => {
  const policy = read('src/components/legal/legal-policy-page.tsx');
  assert.match(policy, /مؤشرات ونتائج مجمعة ومزالة معرّفات المصدر/);
  assert.match(policy, /aggregated indicators with source identifiers removed/);
  assert.match(policy, /لا نعرض للعملاء الآخرين بيانات متجرك أو هويتك أو سجلاتك الخام/);
  assert.match(policy, /We do not expose your store data, identity, or raw records to other customers/);
  assert.match(policy, /not currently enabled for production customers/);
  assert.match(policy, /Provider responses or uploaded files may contain information about your store's customers/);
  assert.match(policy, /Some service providers may operate outside Saudi Arabia/);
  assert.match(policy, /غير مفعلة حاليًا لعملاء الإنتاج/);
  assert.doesNotMatch(policy, /fully anonymous|مجهولة الهوية بالكامل/i);
});

test('canonical policy is reachable from landing footer, login, and settings', () => {
  assert.match(read('src/components/layout/footer.tsx'), /href="\/privacy"/);
  assert.match(read('src/app/login/page.tsx'), /href="\/privacy"/);
  assert.match(read('src/app/(authenticated)/settings/settings-client.tsx'), /href="\/privacy"/);
  assert.match(read('src/app/privacy/page.tsx'), /LegalPolicyPage kind="privacy"/);
});

test('Terms contains only a concise cross-store privacy reference', () => {
  const policy = read('src/components/legal/legal-policy-page.tsx');
  assert.match(policy, /تحسين الخدمة والخصوصية/);
  assert.match(policy, /Service improvement and privacy/);
  assert.match(policy, /راجع سياسة الخصوصية للتفاصيل/);
  assert.match(policy, /These terms alone do not establish a lawful basis/);
});

test('Cross-Store AI feature flag remains fail-closed and turns on only explicitly', () => {
  assert.equal(sharedIntelligenceAiMode(undefined), 'off');
  assert.equal(sharedIntelligenceAiMode('invalid'), 'off');
  assert.equal(sharedIntelligenceAiMode('shadow'), 'shadow');
  assert.equal(sharedIntelligenceAiMode('on'), 'on');
});
