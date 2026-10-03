import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getPlanLimits } from '../src/lib/subscription/plans';
import { t } from '../src/lib/i18n/translations';
import { pricingFeaturesForPlan } from '../src/lib/pricing/feature-matrix';

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

  assert.equal(t('ar', 'pricing.matrix.stores.business'), 'حتى 10 متاجر');
  assert.equal(t('en', 'pricing.matrix.reports.business'), 'Up to 999,999 reports per month');
  assert.equal(t('en', 'pricing.matrix.apiAccess'), 'API access');
});

test('feature matrix uses the real paid-plan gates and exposes inherited capabilities', () => {
  const starter = Object.fromEntries(pricingFeaturesForPlan('starter').map((feature) => [feature.id, feature.included]));
  const growth = Object.fromEntries(pricingFeaturesForPlan('growth').map((feature) => [feature.id, feature.included]));
  const business = Object.fromEntries(pricingFeaturesForPlan('business').map((feature) => [feature.id, feature.included]));

  assert.deepEqual(starter, {
    stores: true,
    csv: true,
    salla: true,
    reports: true,
    aiAssistant: true,
    aiRecommendations: true,
    dataExport: false,
    apiAccess: false,
  });
  assert.deepEqual(growth, { ...starter });
  assert.deepEqual(business, { ...growth, apiAccess: true });
  assert.equal(getPlanLimits('starter').maxStores, 1);
  assert.equal(getPlanLimits('growth').maxStores, 3);
  assert.equal(getPlanLimits('business').maxStores, 10);
  assert.equal(getPlanLimits('starter').maxReportsPerMonth, 30);
  assert.equal(getPlanLimits('growth').maxReportsPerMonth, 200);
  assert.equal(getPlanLimits('business').maxReportsPerMonth, 999999);
});

test('unsupported marketing claims are not part of the public pricing matrix', () => {
  const matrix = readFileSync(
    new URL('../src/lib/pricing/feature-matrix.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(matrix, /prioritySupport|dailyUpdate|monthlyReview|directSupport/);
  assert.match(source, /pricingFeaturesForPlan/);
  assert.match(source, /pricing\.matrix\.included/);
  assert.match(source, /pricing\.matrix\.unavailable/);
});

test('pricing cards expose only real CTA links as interactive controls', () => {
  assert.doesNotMatch(source, /setSelectedPlan|hoveredPlan|tabIndex=\{0\}/);
  assert.match(source, /<Button asChild[\s\S]*<Link href=\{buttonHref\}/);
});
