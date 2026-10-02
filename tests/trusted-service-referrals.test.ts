import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Node 22 provides node:sqlite; the project intentionally retains Node 20 type declarations.
import { DatabaseSync } from 'node:sqlite';
import {
  readReferralAdminDashboard,
  referralMetric,
  ReferralAdminError,
  savePartnerOffer,
  saveServiceCategory,
} from '../src/lib/referrals/admin';
import {
  createEligibleReferralHandler,
  createShownReferralHandler,
} from '../src/lib/referrals/handler';
import { createReferralRepository, type ReferralDb } from '../src/lib/referrals/repository';
import {
  getEligibleReferrals,
  markReferralShown,
  ReferralAccessError,
  registerReferralClick,
} from '../src/lib/referrals/service';
import type { LandingFinding } from '../src/lib/landing-page/types';
import { normalizePartnerUrl } from '../src/lib/referrals/validation';
import {
  closeManualConversion,
  submitManualConversion,
  verifyManualConversion,
} from '../src/lib/referrals/conversions';

const NOW = Date.UTC(2026, 9, 2, 10, 0, 0);
const SUPER_ADMIN = { id: 'admin-1', role: 'super_admin' };

function finding(
  findingCode = 'landing.cta.missing.v1',
  overrides: Partial<LandingFinding> = {}
): LandingFinding {
  return {
    findingCode,
    title: 'Missing primary action',
    description: 'No primary action was found in the captured storefront HTML.',
    evidence: [{ signal: 'cta.count', observed: 0, expected: 1 }],
    potentialImpact: 'Customers may not know how to continue.',
    recommendation: 'Add one clear primary action.',
    confidence: 'high',
    severity: 'high',
    source: 'deterministic',
    analyzerVersion: 'landing_page_analyzer_v1',
    eligibleServiceCategories: ['landing_page_optimization'],
    ...overrides,
  };
}

function referralDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users (id TEXT PRIMARY KEY, plan TEXT NOT NULL);
    CREATE TABLE admin_accounts (id TEXT PRIMARY KEY);
    CREATE TABLE admin_audit_log (
      id TEXT PRIMARY KEY, admin_id TEXT, action TEXT NOT NULL, target_type TEXT,
      target_id TEXT, ip_hash TEXT, metadata_json TEXT, created_at INTEGER NOT NULL
    );
    CREATE TABLE salla_connections (
      merchantId TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE landing_page_analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      status TEXT NOT NULL,
      analyzer_version TEXT NOT NULL,
      findings_json TEXT
    );
    INSERT INTO users VALUES ('user-1','growth'), ('user-2','free');
    INSERT INTO admin_accounts VALUES ('admin-1');
    INSERT INTO salla_connections VALUES
      ('merchant-1','user-1','connected'),
      ('merchant-2','user-2','connected');
  `);
  sqlite.exec(readFileSync(
    new URL('../migrations/0022_trusted_service_referrals.sql', import.meta.url),
    'utf8'
  ));
  sqlite.exec(readFileSync(
    new URL('../migrations/0023_referral_unique_audience_metrics.sql', import.meta.url),
    'utf8'
  ));
  sqlite.exec(readFileSync(
    new URL('../migrations/0024_referral_conversions_commissions.sql', import.meta.url),
    'utf8'
  ));

  const db: ReferralDb = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        get: async (...params: unknown[]) => statement.get(...params as never[]) as Record<string, unknown> | undefined,
        all: async (...params: unknown[]) => statement.all(...params as never[]) as Record<string, unknown>[],
        run: async (...params: unknown[]) => statement.run(...params as never[]),
      };
    },
    async batch(operations) {
      sqlite.exec('BEGIN');
      try {
        for (const operation of operations) {
          sqlite.prepare(operation.sql).run(...(operation.params ?? []) as never[]);
        }
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sqlite, db, repository: createReferralRepository(db) };
}

function insertAnalysis(
  sqlite: DatabaseSync,
  id: string,
  userId: string,
  merchantId: string,
  findings: LandingFinding[],
  status = 'succeeded'
) {
  sqlite.prepare(`INSERT INTO landing_page_analyses
    (id, user_id, merchant_id, status, analyzer_version, findings_json)
    VALUES (?, ?, ?, ?, 'landing_page_analyzer_v1', ?)`)
    .run(id, userId, merchantId, status, JSON.stringify(findings));
}

async function configureCategory(db: ReferralDb, overrides: Record<string, unknown> = {}) {
  return saveServiceCategory({
    admin: SUPER_ADMIN,
    db,
    now: () => NOW,
    data: {
      id: 'svc_landing_page_optimization',
      slug: 'landing_page_optimization',
      nameAr: 'تحسين صفحة المتجر',
      nameEn: 'Landing Page Optimization',
      descriptionAr: 'تنفيذ تحسينات مثبتة بالأدلة.',
      descriptionEn: 'Implement evidence-backed improvements.',
      active: true,
      minimumConfidence: 'high',
      minimumSeverity: 'medium',
      maxReferralsPerAnalysis: 1,
      ...overrides,
    },
  });
}

async function addOffer(
  db: ReferralDb,
  id = 'offer-1',
  overrides: Record<string, unknown> = {}
) {
  return savePartnerOffer({
    admin: SUPER_ADMIN,
    db,
    createId: () => id,
    now: () => NOW,
    data: {
      serviceCategoryId: 'svc_landing_page_optimization',
      partnerName: `Partner ${id}`,
      partnerUrl: `https://partner.example/${id}?campaign=isaudi#removed`,
      serviceTitleAr: 'تحسين صفحة المتجر',
      serviceTitleEn: 'Storefront optimization',
      descriptionAr: 'خدمة اختيارية من شريك معتمد.',
      descriptionEn: 'Optional service from an approved partner.',
      supportedPlatforms: ['salla'],
      commissionType: 'percentage',
      commissionRateBps: 0,
      fixedAmountHalala: null,
      commissionCurrency: null,
      status: 'active',
      displayPriority: 10,
      qualityStatus: 'approved',
      ...overrides,
    },
  });
}

test('migration seeds one inactive category and no fabricated partner offer', () => {
  const { sqlite } = referralDatabase();
  const category = sqlite.prepare(`SELECT slug, active FROM service_categories`).get() as Record<string, unknown>;
  assert.deepEqual({ ...category }, { slug: 'landing_page_optimization', active: 0 });
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM partner_offers').get()!.n, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM service_referrals').get()!.n, 0);
  sqlite.close();
});

test('Admin category and offer writes require super_admin and validate partner trust state', async () => {
  const { sqlite, db } = referralDatabase();
  await assert.rejects(
    saveServiceCategory({ admin: { id: 'admin-1', role: 'support' }, db, data: {} }),
    (error: unknown) => error instanceof ReferralAdminError && error.status === 403
  );
  await configureCategory(db);
  await saveServiceCategory({
    admin: SUPER_ADMIN, db, createId: () => 'category-seo', now: () => NOW,
    data: {
      slug: 'seo', nameAr: 'تحسين محركات البحث', nameEn: 'SEO',
      descriptionAr: '', descriptionEn: '', active: false,
      minimumConfidence: 'high', minimumSeverity: 'high', maxReferralsPerAnalysis: 1,
    },
  });
  await saveServiceCategory({
    admin: SUPER_ADMIN, db, now: () => NOW + 1,
    data: {
      id: 'category-seo', slug: 'seo', nameAr: 'تحسين البحث', nameEn: 'Search optimization',
      descriptionAr: '', descriptionEn: '', active: true,
      minimumConfidence: 'medium', minimumSeverity: 'medium', maxReferralsPerAnalysis: 2,
    },
  });
  assert.deepEqual(
    { ...sqlite.prepare(`SELECT name_en, active, max_referrals_per_analysis
      FROM service_categories WHERE id='category-seo'`).get()! },
    { name_en: 'Search optimization', active: 1, max_referrals_per_analysis: 2 }
  );
  await assert.rejects(
    addOffer(db, 'review-offer', { qualityStatus: 'review', status: 'active' }),
    (error: unknown) => error instanceof ReferralAdminError && error.reason === 'active_offer_requires_approval'
  );
  await addOffer(db);
  await addOffer(db, 'ignored', {
    id: 'offer-1', partnerName: 'Edited Partner', status: 'inactive', displayPriority: 20,
  });
  assert.deepEqual(
    { ...sqlite.prepare(`SELECT partner_name, status, display_priority
      FROM partner_offers WHERE id='offer-1'`).get()! },
    { partner_name: 'Edited Partner', status: 'inactive', display_priority: 20 }
  );
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM partner_offers').get()!.n, 1);
  sqlite.close();
});

test('partner destinations reject SSRF-prone and untrusted URL forms', () => {
  for (const value of [
    'http://partner.example',
    'https://user:pass@partner.example',
    'https://partner.example:444/path',
    'https://localhost/path',
    'https://127.0.0.1/path',
    'https://10.0.0.1/path',
    'file:///etc/passwd',
  ]) assert.throws(() => normalizePartnerUrl(value), /invalid_partner_url/);
  assert.equal(
    normalizePartnerUrl('https://partner.example/offer?campaign=isaudi#private'),
    'https://partner.example/offer?campaign=isaudi'
  );
});

test('no evidence, inactive category, unmet threshold, or unavailable partner produces no referral', async () => {
  const { sqlite, db, repository } = referralDatabase();
  insertAnalysis(sqlite, 'empty', 'user-1', 'merchant-1', []);
  insertAnalysis(sqlite, 'mapped', 'user-1', 'merchant-1', [finding()]);
  assert.equal((await getEligibleReferrals({ userId: 'user-1', analysisId: 'empty', repository })).reason, 'no_findings');
  assert.equal((await getEligibleReferrals({ userId: 'user-1', analysisId: 'mapped', repository })).reason, 'category_inactive');
  await configureCategory(db, { minimumSeverity: 'critical' });
  assert.equal((await getEligibleReferrals({ userId: 'user-1', analysisId: 'mapped', repository })).reason, 'threshold_not_met');
  await configureCategory(db, { minimumSeverity: 'medium' });
  assert.equal((await getEligibleReferrals({ userId: 'user-1', analysisId: 'mapped', repository })).reason, 'partner_unavailable');
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM service_referrals').get()!.n, 0);
  sqlite.close();
});

test('missing category, inactive partner, platform mismatch, and referral limit fail closed', async () => {
  {
    const { sqlite, repository } = referralDatabase();
    insertAnalysis(sqlite, 'analysis-1', 'user-1', 'merchant-1', [finding()]);
    sqlite.prepare(`DELETE FROM service_categories WHERE slug='landing_page_optimization'`).run();
    assert.equal((await getEligibleReferrals({
      userId: 'user-1', analysisId: 'analysis-1', repository,
    })).referrals.length, 0);
    sqlite.close();
  }
  {
    const { sqlite, db, repository } = referralDatabase();
    insertAnalysis(sqlite, 'analysis-1', 'user-1', 'merchant-1', [finding()]);
    await configureCategory(db);
    await addOffer(db, 'inactive', { status: 'inactive' });
    assert.equal((await getEligibleReferrals({
      userId: 'user-1', analysisId: 'analysis-1', repository,
    })).reason, 'partner_unavailable');
    sqlite.prepare(`UPDATE partner_offers SET status='active', supported_platforms_json='["shopify"]'
      WHERE id='inactive'`).run();
    assert.equal((await getEligibleReferrals({
      userId: 'user-1', analysisId: 'analysis-1', repository,
    })).referrals.length, 0);
    sqlite.close();
  }
  {
    const { sqlite, db, repository } = referralDatabase();
    insertAnalysis(sqlite, 'analysis-1', 'user-1', 'merchant-1', [
      finding('landing.cta.missing.v1'),
      finding('landing.heading.h1_missing.v1'),
    ]);
    await configureCategory(db, { maxReferralsPerAnalysis: 1 });
    await addOffer(db);
    const result = await getEligibleReferrals({
      userId: 'user-1', analysisId: 'analysis-1', repository,
      createId: () => 'only-referral', now: () => NOW,
    });
    assert.equal(result.referrals.length, 1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM service_referrals').get()!.n, 1);
    sqlite.close();
  }
});

test('offer selection is deterministic by quality, platform, and priority—not commission', async () => {
  const { sqlite, db, repository } = referralDatabase();
  insertAnalysis(sqlite, 'analysis-1', 'user-1', 'merchant-1', [finding()]);
  await configureCategory(db);
  await addOffer(db, 'preferred', { displayPriority: 5, commissionRateBps: 0 });
  await addOffer(db, 'high-commission', { displayPriority: 50, commissionRateBps: 9000 });
  const result = await getEligibleReferrals({
    userId: 'user-1', analysisId: 'analysis-1', repository,
    createId: () => 'referral-1', now: () => NOW,
  });
  assert.equal(result.referrals.length, 1);
  assert.equal(result.referrals[0].offer.partnerName, 'Partner preferred');
  const stored = sqlite.prepare(`SELECT partner_offer_id, commission_snapshot_json,
    commission_earned_halala FROM service_referrals`).get() as Record<string, unknown>;
  assert.equal(stored.partner_offer_id, 'preferred');
  assert.equal(stored.commission_snapshot_json, null);
  assert.equal(stored.commission_earned_halala, null);
  sqlite.close();
});

test('eligibility and display are tenant scoped, idempotent, and server derived', async () => {
  const { sqlite, db, repository } = referralDatabase();
  insertAnalysis(sqlite, 'analysis-1', 'user-1', 'merchant-1', [finding()]);
  await configureCategory(db);
  await addOffer(db);
  const first = await getEligibleReferrals({
    userId: 'user-1', analysisId: 'analysis-1', repository,
    createId: () => 'referral-1', now: () => NOW,
  });
  const repeat = await getEligibleReferrals({
    userId: 'user-1', analysisId: 'analysis-1', repository,
    createId: () => 'should-not-be-used', now: () => NOW + 1,
  });
  assert.equal(first.referrals[0].referralId, 'referral-1');
  assert.equal(repeat.referrals[0].referralId, 'referral-1');
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM service_referrals').get()!.n, 1);
  await assert.rejects(
    getEligibleReferrals({ userId: 'user-2', analysisId: 'analysis-1', repository }),
    (error: unknown) => error instanceof ReferralAccessError && error.status === 404
  );
  await markReferralShown({ userId: 'user-1', referralId: 'referral-1', repository, createId: () => 'shown-1', now: () => NOW + 2 });
  await markReferralShown({ userId: 'user-1', referralId: 'referral-1', repository, createId: () => 'shown-2', now: () => NOW + 3 });
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM referral_events WHERE event_type='shown'`).get()!.n, 1);
  await assert.rejects(
    markReferralShown({ userId: 'user-2', referralId: 'referral-1', repository }),
    (error: unknown) => error instanceof ReferralAccessError && error.status === 404
  );
  sqlite.close();
});

test('clicks preserve total versus unique metrics and never create commission', async () => {
  const { sqlite, db, repository } = referralDatabase();
  insertAnalysis(sqlite, 'analysis-1', 'user-1', 'merchant-1', [finding()]);
  await configureCategory(db);
  await addOffer(db);
  await getEligibleReferrals({ userId: 'user-1', analysisId: 'analysis-1', repository, createId: () => 'referral-1', now: () => NOW });
  await markReferralShown({ userId: 'user-1', referralId: 'referral-1', repository, createId: () => 'shown-1', now: () => NOW + 1 });
  const first = await registerReferralClick({ userId: 'user-1', referralId: 'referral-1', repository, createId: () => 'click-1', now: () => NOW + 2 });
  const second = await registerReferralClick({ userId: 'user-1', referralId: 'referral-1', repository, createId: () => 'click-2', now: () => NOW + 3 });
  assert.equal(first, 'https://partner.example/offer-1?campaign=isaudi');
  assert.equal(second, first);
  const metrics = sqlite.prepare(`SELECT referrals_count, shown_count, clicks_count,
    unique_clickers_count FROM referral_daily_metrics`).get() as Record<string, unknown>;
  assert.deepEqual({ ...metrics }, {
    referrals_count: 1, shown_count: 1, clicks_count: 2, unique_clickers_count: 1,
  });
  const audience = sqlite.prepare(`SELECT audience_kind, period_kind, unique_users_count
    FROM referral_audience_metrics ORDER BY audience_kind, period_kind`).all();
  assert.deepEqual(audience.map((row: Record<string, unknown>) => ({ ...row })), [
    { audience_kind: 'clicker', period_kind: 'day', unique_users_count: 1 },
    { audience_kind: 'clicker', period_kind: 'month', unique_users_count: 1 },
    { audience_kind: 'viewer', period_kind: 'day', unique_users_count: 1 },
    { audience_kind: 'viewer', period_kind: 'month', unique_users_count: 1 },
  ]);
  const referral = sqlite.prepare(`SELECT status, commission_snapshot_json,
    commission_earned_halala FROM service_referrals`).get() as Record<string, unknown>;
  assert.deepEqual({ ...referral }, {
    status: 'clicked', commission_snapshot_json: null, commission_earned_halala: null,
  });
  sqlite.close();
});

test('disabled offers block future redirects without deleting historical referral data', async () => {
  const { sqlite, db, repository } = referralDatabase();
  insertAnalysis(sqlite, 'analysis-1', 'user-1', 'merchant-1', [finding()]);
  await configureCategory(db);
  await addOffer(db);
  await getEligibleReferrals({ userId: 'user-1', analysisId: 'analysis-1', repository, createId: () => 'referral-1', now: () => NOW });
  sqlite.prepare(`UPDATE partner_offers SET status='suspended' WHERE id='offer-1'`).run();
  await assert.rejects(
    registerReferralClick({ userId: 'user-1', referralId: 'referral-1', repository }),
    (error: unknown) => error instanceof ReferralAccessError && error.status === 410
  );
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM service_referrals').get()!.n, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM referral_events').get()!.n, 0);
  sqlite.close();
});

test('customer HTTP handlers accept only owned server-side identifiers', async () => {
  let received: Record<string, unknown> | undefined;
  const eligible = createEligibleReferralHandler({
    getUser: async () => ({ id: 'user-1' }),
    eligible: async (input) => {
      received = input;
      return { analysisId: input.analysisId, referrals: [], reason: 'no_findings' };
    },
  });
  const malicious = await eligible(new Request('https://isaudi.ai/api/referrals/eligible', {
    method: 'POST', body: JSON.stringify({ analysisId: 'analysis-1', userId: 'user-2', partnerId: 'evil' }),
  }));
  assert.equal(malicious.status, 400);
  const accepted = await eligible(new Request('https://isaudi.ai/api/referrals/eligible', {
    method: 'POST', body: JSON.stringify({ analysisId: 'analysis-1' }),
  }));
  assert.equal(accepted.status, 200);
  assert.deepEqual(received, { userId: 'user-1', analysisId: 'analysis-1' });
  assert.equal(accepted.headers.get('Cache-Control'), 'private, no-store');

  const shown = createShownReferralHandler({
    getUser: async () => null,
    shown: async () => assert.fail('must not run'),
  });
  assert.equal((await shown(new Request('https://isaudi.ai/api/referrals/shown', {
    method: 'POST', body: JSON.stringify({ referralId: 'referral-1' }),
  }))).status, 401);
});

test('Admin reads are bounded, aggregate-backed, pseudonymous, and commission-safe', async () => {
  const { sqlite, db, repository } = referralDatabase();
  insertAnalysis(sqlite, 'analysis-1', 'user-1', 'merchant-1', [finding()]);
  await configureCategory(db);
  await addOffer(db);
  await getEligibleReferrals({ userId: 'user-1', analysisId: 'analysis-1', repository, createId: () => 'referral-1', now: () => NOW });
  await markReferralShown({ userId: 'user-1', referralId: 'referral-1', repository, createId: () => 'shown-1', now: () => NOW + 1 });
  await registerReferralClick({ userId: 'user-1', referralId: 'referral-1', repository, createId: () => 'click-1', now: () => NOW + 2 });
  const dashboard = await readReferralAdminDashboard({ admin: SUPER_ADMIN, db, now: () => NOW + 3 });
  assert.deepEqual(dashboard.metrics.today, {
    referrals: 1, shown: 1, uniqueViewers: 1, clicks: 1, uniqueClickers: 1, ctr: 1,
  });
  assert.match(String(dashboard.referrals[0].customer_identifier), /^cust_[a-f0-9]{12}$/);
  assert.equal('user_id' in dashboard.referrals[0], false);
  assert.equal(dashboard.commissions.verifiedConversions, 0);
  assert.deepEqual(dashboard.commissions.byCurrency, []);
  await assert.rejects(
    readReferralAdminDashboard({ admin: { id: 'admin-1', role: 'analyst' }, db }),
    (error: unknown) => error instanceof ReferralAdminError && error.status === 403
  );
  sqlite.close();
});

test('verified manual conversion earns one rounded commission and snapshots commercial terms', async () => {
  const { sqlite, db, repository } = referralDatabase();
  insertAnalysis(sqlite, 'analysis-1', 'user-1', 'merchant-1', [finding()]);
  await configureCategory(db);
  await addOffer(db, 'offer-1', { commissionRateBps: 1000, commissionBasis: 'service_value' });
  await getEligibleReferrals({ userId: 'user-1', analysisId: 'analysis-1', repository, createId: () => 'referral-1', now: () => NOW });
  let sequence = 0;
  const createId = () => `phase6d-${++sequence}`;
  const submitted = await submitManualConversion({
    admin: SUPER_ADMIN, db, createId, now: () => NOW + 10, ipHash: 'ip-hash',
    data: {
      referralId: 'referral-1', externalReference: 'invoice-verified-1',
      convertedAt: NOW + 5, amountHalala: 12345, currency: 'sar',
    },
  });
  assert.equal(submitted.status, 'submitted');
  assert.deepEqual({ ...sqlite.prepare(`SELECT user_id, merchant_id, partner_offer_id, source
    FROM referral_conversions WHERE id=?`).get(submitted.id)! }, {
    user_id: 'user-1', merchant_id: 'merchant-1', partner_offer_id: 'offer-1',
    source: 'manual_admin_verification',
  });
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM referral_commissions').get()!.n, 0);
  const verified = await verifyManualConversion({
    admin: SUPER_ADMIN, db, createId, now: () => NOW + 20,
    conversionId: submitted.id, ipHash: 'ip-hash',
  });
  assert.equal(verified.status, 'verified');
  const commission = sqlite.prepare(`SELECT status, commission_rate_bps_snapshot,
    commission_basis_snapshot, base_amount_halala, commission_amount_halala, currency
    FROM referral_commissions`).get() as Record<string, unknown>;
  assert.deepEqual({ ...commission }, {
    status: 'earned', commission_rate_bps_snapshot: 1000,
    commission_basis_snapshot: 'service_value', base_amount_halala: 12345,
    commission_amount_halala: 1235, currency: 'SAR',
  });
  await addOffer(db, 'offer-1', {
    id: 'offer-1', commissionRateBps: 2000, commissionBasis: 'contract_value',
  });
  const immutable = sqlite.prepare(`SELECT commission_rate_bps_snapshot,
    commission_basis_snapshot, commission_amount_halala FROM referral_commissions`).get();
  assert.deepEqual({ ...immutable! }, {
    commission_rate_bps_snapshot: 1000,
    commission_basis_snapshot: 'service_value',
    commission_amount_halala: 1235,
  });
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM admin_audit_log
    WHERE action IN ('referral_conversion_submitted','referral_conversion_verified')`).get()!.n, 2);
  assert.equal(sqlite.prepare(`SELECT status FROM service_referrals WHERE id='referral-1'`).get()!.status, 'converted');
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM referral_events WHERE event_type='converted'`).get()!.n, 1);
  const dashboard = await readReferralAdminDashboard({ admin: SUPER_ADMIN, db, now: () => NOW + 30 });
  assert.equal(dashboard.commissions.verifiedConversions, 1);
  assert.deepEqual(dashboard.commissions.byCurrency, [{
    currency: 'SAR', earnedHalala: 1235, approvedHalala: 0, paidHalala: 0,
  }]);
  sqlite.close();
});

test('clicks never create conversions and missing commission basis cannot be verified', async () => {
  const { sqlite, db, repository } = referralDatabase();
  insertAnalysis(sqlite, 'analysis-1', 'user-1', 'merchant-1', [finding()]);
  await configureCategory(db);
  await addOffer(db, 'offer-1', { commissionRateBps: 1000 });
  await getEligibleReferrals({ userId: 'user-1', analysisId: 'analysis-1', repository, createId: () => 'referral-1', now: () => NOW });
  await markReferralShown({ userId: 'user-1', referralId: 'referral-1', repository, createId: () => 'shown-1', now: () => NOW + 1 });
  for (let index = 0; index < 5; index += 1) {
    await registerReferralClick({ userId: 'user-1', referralId: 'referral-1', repository, createId: () => `click-${index}`, now: () => NOW + 2 + index });
  }
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM referral_conversions').get()!.n, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM referral_commissions').get()!.n, 0);
  let sequence = 0;
  const submitted = await submitManualConversion({
    admin: SUPER_ADMIN, db, createId: () => `missing-basis-${++sequence}`, now: () => NOW + 20,
    data: { referralId: 'referral-1', externalReference: 'evidence-1', convertedAt: NOW + 10, amountHalala: 10000, currency: 'SAR' },
  });
  await assert.rejects(
    verifyManualConversion({ admin: SUPER_ADMIN, db, conversionId: submitted.id }),
    (error: unknown) => error instanceof ReferralAdminError && error.reason === 'commission_basis_not_configured'
  );
  assert.equal(sqlite.prepare('SELECT status FROM referral_conversions').get()!.status, 'submitted');
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM referral_commissions').get()!.n, 0);
  sqlite.close();
});

test('conversion attribution, idempotency, validation, authorization, and terminal states are enforced', async () => {
  const { sqlite, db, repository } = referralDatabase();
  insertAnalysis(sqlite, 'analysis-1', 'user-1', 'merchant-1', [finding()]);
  await configureCategory(db);
  await addOffer(db, 'offer-1', { commissionRateBps: 1000, commissionBasis: 'service_value' });
  await getEligibleReferrals({ userId: 'user-1', analysisId: 'analysis-1', repository, createId: () => 'referral-1', now: () => NOW });
  await assert.rejects(
    submitManualConversion({ admin: { id: 'admin-1', role: 'support' }, db, data: {} }),
    (error: unknown) => error instanceof ReferralAdminError && error.status === 403
  );
  await assert.rejects(
    submitManualConversion({ admin: SUPER_ADMIN, db, data: { referralId: 'wrong', externalReference: 'x', convertedAt: NOW } }),
    (error: unknown) => error instanceof ReferralAdminError && error.reason === 'referral_not_found'
  );
  await assert.rejects(
    submitManualConversion({ admin: SUPER_ADMIN, db, data: { referralId: 'referral-1', externalReference: '', convertedAt: NOW } }),
    (error: unknown) => error instanceof ReferralAdminError && error.reason === 'invalid_input'
  );
  await assert.rejects(
    submitManualConversion({ admin: SUPER_ADMIN, db, data: { referralId: 'referral-1', externalReference: 'x', convertedAt: NOW, amountHalala: -1, currency: 'SAR' } }),
    (error: unknown) => error instanceof ReferralAdminError && error.reason === 'invalid_amount'
  );
  let sequence = 0;
  const createId = () => `state-${++sequence}`;
  const submitted = await submitManualConversion({
    admin: SUPER_ADMIN, db, createId, now: () => NOW + 1,
    data: { referralId: 'referral-1', externalReference: 'unique-ref', convertedAt: NOW, amountHalala: 0, currency: 'SAR' },
  });
  await assert.rejects(
    submitManualConversion({ admin: SUPER_ADMIN, db, createId, now: () => NOW + 2,
      data: { referralId: 'referral-1', externalReference: 'unique-ref', convertedAt: NOW } }),
    (error: unknown) => error instanceof ReferralAdminError && error.reason === 'duplicate_conversion'
  );
  const closed = await closeManualConversion({
    admin: SUPER_ADMIN, db, createId, conversionId: submitted.id, status: 'rejected', now: () => NOW + 3,
  });
  assert.equal(closed.status, 'rejected');
  await assert.rejects(
    verifyManualConversion({ admin: SUPER_ADMIN, db, conversionId: submitted.id }),
    (error: unknown) => error instanceof ReferralAdminError && error.reason === 'invalid_conversion_transition'
  );
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM admin_audit_log
    WHERE action='referral_conversion_rejected'`).get()!.n, 1);
  sqlite.close();
});

test('CTR uses unique clickers divided by unique viewers, never total clicks', () => {
  const cases = [
    { viewers: 1, clicks: 1, clickers: 1, ctr: 1 },
    { viewers: 1, clicks: 5, clickers: 1, ctr: 1 },
    { viewers: 2, clicks: 1, clickers: 1, ctr: 0.5 },
    { viewers: 2, clicks: 5, clickers: 2, ctr: 1 },
    { viewers: 0, clicks: 0, clickers: 0, ctr: 0 },
  ];
  for (const row of cases) {
    assert.equal(referralMetric({
      shown: row.viewers,
      unique_viewers: row.viewers,
      clicks: row.clicks,
      unique_clickers: row.clickers,
    }).ctr, row.ctr);
  }
});

test('audience migration backfills only distinct users from recorded historical events', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users (id TEXT PRIMARY KEY, plan TEXT NOT NULL);
    CREATE TABLE admin_accounts (id TEXT PRIMARY KEY);
    CREATE TABLE salla_connections (merchantId TEXT PRIMARY KEY, userId TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE landing_page_analyses (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, merchant_id TEXT NOT NULL,
      status TEXT NOT NULL, analyzer_version TEXT NOT NULL, findings_json TEXT
    );
    INSERT INTO users VALUES ('user-1','growth');
    INSERT INTO admin_accounts VALUES ('admin-1');
    INSERT INTO salla_connections VALUES ('merchant-1','user-1','connected');
    INSERT INTO landing_page_analyses VALUES
      ('analysis-1','user-1','merchant-1','succeeded','landing_page_analyzer_v1','[]');
  `);
  sqlite.exec(readFileSync(
    new URL('../migrations/0022_trusted_service_referrals.sql', import.meta.url),
    'utf8'
  ));
  sqlite.prepare(`UPDATE service_categories SET active=1
    WHERE id='svc_landing_page_optimization'`).run();
  sqlite.prepare(`INSERT INTO partner_offers (
    id, service_category_id, partner_name, partner_url, service_title_ar,
    service_title_en, description_ar, description_en, supported_platforms_json,
    commission_type, commission_rate_bps, fixed_amount_halala, commission_currency,
    status, display_priority, quality_status, created_by_admin_id, created_at, updated_at
  ) VALUES ('offer-1','svc_landing_page_optimization','Partner','https://partner.example',
    'خدمة','Service','','','["salla"]','percentage',1000,NULL,NULL,'active',1,'approved','admin-1',?,?)`)
    .run(NOW, NOW);
  sqlite.prepare(`INSERT INTO service_referrals (
    id, user_id, merchant_id, analysis_id, finding_code, service_category_id,
    partner_offer_id, source, plan_snapshot, status, created_at, updated_at
  ) VALUES ('referral-1','user-1','merchant-1','analysis-1','finding-1',
    'svc_landing_page_optimization','offer-1','deterministic','growth','clicked',?,?)`)
    .run(NOW, NOW);
  const insertEvent = sqlite.prepare(`INSERT INTO referral_events (
    id, referral_id, user_id, merchant_id, analysis_id, finding_code,
    service_category_id, partner_offer_id, plan_snapshot, event_type, created_at
  ) VALUES (?, 'referral-1','user-1','merchant-1','analysis-1','finding-1',
    'svc_landing_page_optimization','offer-1','growth',?,?)`);
  insertEvent.run('shown-1', 'shown', NOW);
  insertEvent.run('click-1', 'clicked', NOW + 1);
  insertEvent.run('click-2', 'clicked', NOW + 2);
  sqlite.exec(readFileSync(
    new URL('../migrations/0023_referral_unique_audience_metrics.sql', import.meta.url),
    'utf8'
  ));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM referral_unique_audience').get()!.n, 4);
  assert.deepEqual(
    sqlite.prepare(`SELECT audience_kind, period_kind, unique_users_count
      FROM referral_audience_metrics ORDER BY audience_kind, period_kind`).all()
      .map((row: Record<string, unknown>) => ({ ...row })),
    [
      { audience_kind: 'clicker', period_kind: 'day', unique_users_count: 1 },
      { audience_kind: 'clicker', period_kind: 'month', unique_users_count: 1 },
      { audience_kind: 'viewer', period_kind: 'day', unique_users_count: 1 },
      { audience_kind: 'viewer', period_kind: 'month', unique_users_count: 1 },
    ]
  );
  sqlite.close();
});

test('Phase 6C UI and backend remain bilingual, responsive, no-store, and zero-OpenAI', () => {
  const customer = readFileSync(new URL('../src/app/(authenticated)/dashboard/services/services-client.tsx', import.meta.url), 'utf8');
  const admin = readFileSync(new URL('../src/app/admin/service-referrals-manager.tsx', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../src/lib/referrals/service.ts', import.meta.url), 'utf8');
  const repository = readFileSync(new URL('../src/lib/referrals/repository.ts', import.meta.url), 'utf8');
  const handler = readFileSync(new URL('../src/lib/referrals/handler.ts', import.meta.url), 'utf8');
  assert.match(customer, /dir=\{lang === 'ar' \? 'rtl' : 'ltr'\}/);
  assert.match(customer, /min-h-11/);
  assert.match(customer, /\/api\/analysis\/landing-page/);
  assert.match(repository, /\/go\/referral\//);
  assert.match(admin, /إحالات الخدمات/);
  assert.match(admin, /Service Referrals/);
  assert.match(admin, /role="tablist"/);
  assert.match(handler, /private, no-store/);
  assert.doesNotMatch(`${service}\n${repository}`, /OPENAI_API_KEY|requestOpenAI|reserveAiUsage/);
  assert.doesNotMatch(customer, /commissionRate|commission_earned|customer_identifier/);
});
