import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getPlanLimits } from '../src/lib/subscription/plans';
import { t } from '../src/lib/i18n/translations';

const source = readFileSync(
  new URL('../src/components/sections/pricing.tsx', import.meta.url),
  'utf8',
);

test('Growth badge sits outside the clipped pricing card layer', () => {
  assert.match(source, /data-popular-badge/);
  assert.match(source, /data-pricing-card/);
  assert.ok(source.indexOf('data-popular-badge') < source.indexOf('data-pricing-card'));
  assert.match(source, /relative flex h-full pt-4/);
});

test('Business presentation reflects implemented entitlements only', () => {
  const growth = getPlanLimits('growth');
  const business = getPlanLimits('business');

  assert.ok(business.maxStores >= growth.maxStores);
  assert.ok(business.maxReportsPerMonth >= growth.maxReportsPerMonth);
  assert.equal(business.aiInsights, growth.aiInsights);
  assert.equal(growth.apiAccess, false);
  assert.equal(business.apiAccess, true);

  assert.equal(t('ar', 'pricing.plan.business.feature1'), 'حتى 10 متاجر');
  assert.equal(t('en', 'pricing.plan.business.feature2'), 'Up to 999,999 reports per month');
  assert.equal(t('en', 'pricing.plan.business.feature3'), 'API access');
  assert.doesNotMatch(source, /pricing\.plan\.business\.feature4/);
});

test('pricing cards expose only real CTA links as interactive controls', () => {
  assert.doesNotMatch(source, /setSelectedPlan|hoveredPlan|tabIndex=\{0\}/);
  assert.match(source, /<Button asChild[\s\S]*<Link href=\{buttonHref\}/);
});
