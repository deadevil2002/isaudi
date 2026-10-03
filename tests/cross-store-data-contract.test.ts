import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type Policy = {
  classification: string;
  allowedDerivation: string;
  purpose: string;
  retention: string;
  deletionBehavior: string;
  contributionBound: string;
  minimumTenants: number | null;
  minimumTenantDiversity: string;
  suppressionRule: string;
  version: number;
  notes: string;
};

type Contract = {
  productionAuthorized: boolean;
  status: string;
  thresholds: {
    prevalenceDistinctTenants: number;
    outcomeDistinctTenants: number;
    approvalStatus: string;
    unit: string;
  };
  contributionBound: { maximum: number; multiStoreRule: string };
  policies: Record<string, Policy>;
  inventory: Array<{ source: string; table: string; fields: Record<string, string> }>;
  sharedPattern: {
    allowedFields: string[];
    forbiddenFieldNames: string[];
    lifecycleStatuses: string[];
    customerRetrievableStatuses: string[];
  };
  intervention: { notEvidence: string[] };
  outcome: { defaultEvidenceClass: string; causalClaimAllowed: boolean };
  confidence: { separateDimensions: string[] };
  retention: Record<string, string>;
  deletion: { requiredSteps: string[] };
  legalGates: string[];
};

const contract = JSON.parse(readFileSync(
  new URL('../docs/phase-7/cross-store-data-contract.v1.json', import.meta.url),
  'utf8'
)) as Contract;

const requiredPolicyKeys: Array<keyof Policy> = [
  'classification', 'allowedDerivation', 'purpose', 'retention',
  'deletionBehavior', 'contributionBound', 'minimumTenants',
  'minimumTenantDiversity', 'suppressionRule', 'version', 'notes',
];

test('Phase 7A contract is provisional and cannot authorize production', () => {
  assert.equal(contract.status, 'provisional');
  assert.equal(contract.productionAuthorized, false);
  assert.equal(contract.thresholds.approvalStatus, 'PROVISIONAL');
  assert.equal(contract.thresholds.prevalenceDistinctTenants, 20);
  assert.equal(contract.thresholds.outcomeDistinctTenants, 30);
  assert.match(contract.thresholds.unit, /distinct_customer_tenants/);
});

test('every inventoried field resolves to a complete policy', () => {
  assert.ok(contract.inventory.length >= 35);
  for (const entry of contract.inventory) {
    assert.ok(Object.keys(entry.fields).length > 0, `${entry.table} has no fields`);
    for (const [field, policyId] of Object.entries(entry.fields)) {
      const policy = contract.policies[policyId];
      assert.ok(policy, `${entry.table}.${field} has unknown policy ${policyId}`);
      for (const key of requiredPolicyKeys) {
        assert.ok(Object.hasOwn(policy, key), `${policyId} lacks ${key}`);
      }
    }
  }
});

test('required source families and high-risk fields are explicitly inventoried', () => {
  const tables = new Set(contract.inventory.map((entry) => entry.table));
  for (const table of [
    'users', 'sessions', 'otp_challenges', 'store_connections', 'salla_connections',
    'products', 'orders', 'order_items', 'product_costs', 'reports', 'report_snapshots',
    'landing_page_analyses', 'LandingFinding', 'ai_usage_ledger', 'service_referrals',
    'referral_events', 'referral_conversions', 'referral_commissions', 'PLAN_CATALOG',
    'user_runtime_summaries', 'admin_observability_summary',
  ]) assert.ok(tables.has(table), `missing ${table}`);

  const fieldPolicy = (table: string, field: string) =>
    contract.inventory.find((entry) => entry.table === table)?.fields[field];
  assert.equal(fieldPolicy('users', 'email'), 'forbidden_identity');
  assert.equal(fieldPolicy('salla_connections', 'accessTokenEncrypted'), 'forbidden_secret');
  assert.equal(fieldPolicy('reports', 'reportJson'), 'forbidden_private_document');
  assert.equal(fieldPolicy('partner_offers', 'commission_rate_bps'), 'forbidden_commercial');
  assert.equal(fieldPolicy('products', 'category'), 'allow_business_category');
  assert.equal(fieldPolicy('report_snapshots', 'margin_pct_x100'), 'allow_margin_band');
  assert.equal(fieldPolicy('LandingFinding', 'findingCode'), 'allow_finding_code');
});

test('shared pattern schema is an allowlist with no forbidden identity or commercial field', () => {
  const allowed = new Set(contract.sharedPattern.allowedFields);
  for (const forbidden of contract.sharedPattern.forbiddenFieldNames) {
    assert.equal(allowed.has(forbidden), false, `${forbidden} leaked into shared schema`);
  }
  assert.ok(allowed.has('findingCode'));
  assert.ok(allowed.has('anonymousSegment'));
  assert.ok(allowed.has('tenantDiversity'));
  assert.deepEqual(contract.sharedPattern.customerRetrievableStatuses, ['active']);
});

test('contribution, intervention, outcome, confidence, deletion, and legal gates fail closed', () => {
  assert.equal(contract.contributionBound.maximum, 1);
  assert.match(contract.contributionBound.multiStoreRule, /one_tenant/);
  for (const event of ['referral_clicked', 'partner_conversion', 'commission_status']) {
    assert.ok(contract.intervention.notEvidence.includes(event));
  }
  assert.equal(contract.outcome.defaultEvidenceClass, 'observed_association');
  assert.equal(contract.outcome.causalClaimAllowed, false);
  assert.deepEqual(contract.confidence.separateDimensions, [
    'analyzerDetectionConfidence', 'patternEvidenceConfidence', 'aiWordingConfidence',
  ]);
  assert.match(contract.retention.privateContribution, /PROVISIONAL/);
  assert.ok(contract.deletion.requiredSteps.includes('remove_private_contribution'));
  assert.ok(contract.deletion.requiredSteps.includes('suppress_if_any_gate_fails'));
  assert.ok(contract.legalGates.includes('DPIA'));
});
