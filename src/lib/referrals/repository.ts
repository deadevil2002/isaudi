import { getDb } from '@/lib/db/client';
import type { LandingFinding } from '@/lib/landing-page/types';
import type { CustomerReferral, PartnerOffer, ServiceCategory } from './types';

export type ReferralDb = {
  prepare(sql: string): {
    get(...params: unknown[]): Promise<Record<string, unknown> | undefined>;
    all(...params: unknown[]): Promise<Record<string, unknown>[]>;
    run(...params: unknown[]): Promise<unknown>;
  };
  batch(operations: Array<{ sql: string; params?: unknown[] }>): Promise<unknown>;
};

export type AnalysisReferralContext = {
  id: string;
  userId: string;
  merchantId: string;
  status: string;
  analyzerVersion: string;
  findings: LandingFinding[];
  plan: string;
  platform: 'salla';
};

type ReferralConfiguration = {
  category: ServiceCategory;
  offers: PartnerOffer[];
};

function number(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function parseCategory(row: Record<string, unknown>): ServiceCategory {
  return {
    id: String(row.category_id),
    slug: String(row.category_slug),
    nameAr: String(row.category_name_ar),
    nameEn: String(row.category_name_en),
    descriptionAr: String(row.category_description_ar ?? ''),
    descriptionEn: String(row.category_description_en ?? ''),
    active: Number(row.category_active) === 1,
    minimumConfidence: String(row.minimum_confidence) as ServiceCategory['minimumConfidence'],
    minimumSeverity: String(row.minimum_severity) as ServiceCategory['minimumSeverity'],
    maxReferralsPerAnalysis: number(row.max_referrals_per_analysis),
    createdAt: number(row.category_created_at),
    updatedAt: number(row.category_updated_at),
  };
}

function parseOffer(row: Record<string, unknown>): PartnerOffer {
  const platforms = JSON.parse(String(row.supported_platforms_json ?? '[]'));
  return {
    id: String(row.offer_id),
    serviceCategoryId: String(row.category_id),
    partnerName: String(row.partner_name),
    partnerUrl: String(row.partner_url),
    serviceTitleAr: String(row.service_title_ar),
    serviceTitleEn: String(row.service_title_en),
    descriptionAr: String(row.offer_description_ar ?? ''),
    descriptionEn: String(row.offer_description_en ?? ''),
    supportedPlatforms: Array.isArray(platforms) ? platforms.map(String) : [],
    commissionType: String(row.commission_type) as PartnerOffer['commissionType'],
    commissionRateBps: row.commission_rate_bps == null ? null : number(row.commission_rate_bps),
    fixedAmountHalala: row.fixed_amount_halala == null ? null : number(row.fixed_amount_halala),
    commissionCurrency: row.commission_currency == null ? null : String(row.commission_currency),
    commissionBasis: row.commission_basis == null
      ? null
      : String(row.commission_basis) as PartnerOffer['commissionBasis'],
    status: String(row.offer_status) as PartnerOffer['status'],
    displayPriority: number(row.display_priority),
    qualityStatus: String(row.quality_status) as PartnerOffer['qualityStatus'],
    createdAt: number(row.offer_created_at),
    updatedAt: number(row.offer_updated_at),
  };
}

function parsePublicReferral(row: Record<string, unknown>, finding: LandingFinding): CustomerReferral {
  return {
    referralId: String(row.id),
    analysisId: String(row.analysis_id),
    findingCode: String(row.finding_code),
    finding,
    category: {
      slug: String(row.category_slug),
      nameAr: String(row.category_name_ar),
      nameEn: String(row.category_name_en),
    },
    offer: {
      partnerName: String(row.partner_name),
      serviceTitleAr: String(row.service_title_ar),
      serviceTitleEn: String(row.service_title_en),
      descriptionAr: String(row.offer_description_ar ?? ''),
      descriptionEn: String(row.offer_description_en ?? ''),
    },
    redirectPath: `/go/referral/${encodeURIComponent(String(row.id))}`,
    status: String(row.status) as CustomerReferral['status'],
  };
}

export function createReferralRepository(db: ReferralDb) {
  return {
    loadAnalysisContext: async (userId: string, analysisId: string): Promise<AnalysisReferralContext | null> => {
      const row = await db.prepare(`
        SELECT a.id, a.user_id, a.merchant_id, a.status, a.analyzer_version,
          a.findings_json, u.plan
        FROM landing_page_analyses a
        JOIN users u ON u.id = a.user_id
        JOIN salla_connections c ON c.merchantId = a.merchant_id
          AND c.userId = a.user_id AND c.status = 'connected'
        WHERE a.id = ? AND a.user_id = ?
        LIMIT 1
      `).get(analysisId, userId);
      if (!row) return null;
      let findings: LandingFinding[] = [];
      try {
        const parsed = JSON.parse(String(row.findings_json ?? '[]'));
        findings = Array.isArray(parsed) ? parsed as LandingFinding[] : [];
      } catch {
        return null;
      }
      return {
        id: String(row.id), userId: String(row.user_id), merchantId: String(row.merchant_id),
        status: String(row.status), analyzerVersion: String(row.analyzer_version),
        findings, plan: String(row.plan ?? 'free'), platform: 'salla',
      };
    },

    loadConfiguration: async (slug: string): Promise<ReferralConfiguration | null> => {
      const rows = await db.prepare(`
        SELECT c.id AS category_id, c.slug AS category_slug,
          c.name_ar AS category_name_ar, c.name_en AS category_name_en,
          c.description_ar AS category_description_ar,
          c.description_en AS category_description_en,
          c.active AS category_active, c.minimum_confidence,
          c.minimum_severity, c.max_referrals_per_analysis,
          c.created_at AS category_created_at, c.updated_at AS category_updated_at,
          o.id AS offer_id, o.partner_name, o.partner_url,
          o.service_title_ar, o.service_title_en,
          o.description_ar AS offer_description_ar,
          o.description_en AS offer_description_en,
          o.supported_platforms_json, o.commission_type,
          o.commission_rate_bps, o.fixed_amount_halala,
          o.commission_currency, o.commission_basis, o.status AS offer_status,
          o.display_priority, o.quality_status,
          o.created_at AS offer_created_at, o.updated_at AS offer_updated_at
        FROM service_categories c
        LEFT JOIN partner_offers o ON o.service_category_id = c.id
          AND o.status = 'active' AND o.quality_status = 'approved'
        WHERE c.slug = ?
        ORDER BY o.display_priority ASC, o.created_at ASC, o.id ASC
        LIMIT 50
      `).all(slug);
      if (!rows.length) return null;
      const category = parseCategory(rows[0]);
      return {
        category,
        offers: rows.filter((row) => row.offer_id != null).map(parseOffer),
      };
    },

    loadActiveReferrals: async (
      userId: string,
      analysisId: string,
      findings: LandingFinding[]
    ): Promise<CustomerReferral[]> => {
      const rows = await db.prepare(`
        SELECT r.id, r.analysis_id, r.finding_code, r.status,
          c.slug AS category_slug, c.name_ar AS category_name_ar,
          c.name_en AS category_name_en, o.partner_name,
          o.service_title_ar, o.service_title_en,
          o.description_ar AS offer_description_ar,
          o.description_en AS offer_description_en
        FROM service_referrals r
        JOIN service_categories c ON c.id = r.service_category_id AND c.active = 1
        JOIN partner_offers o ON o.id = r.partner_offer_id
          AND o.status = 'active' AND o.quality_status = 'approved'
        WHERE r.user_id = ? AND r.analysis_id = ?
          AND r.status IN ('eligible', 'shown', 'clicked')
        ORDER BY r.created_at ASC
        LIMIT 10
      `).all(userId, analysisId);
      const byCode = new Map(findings.map((finding) => [finding.findingCode, finding]));
      return rows.flatMap((row) => {
        const finding = byCode.get(String(row.finding_code));
        return finding ? [parsePublicReferral(row, finding)] : [];
      });
    },

    createReferrals: async (rows: Array<{
      id: string;
      context: AnalysisReferralContext;
      finding: LandingFinding;
      category: ServiceCategory;
      offer: PartnerOffer;
      now: number;
    }>): Promise<void> => {
      if (!rows.length) return;
      await db.batch(rows.flatMap((row) => [
        {
          sql: `INSERT INTO service_referrals (
            id, user_id, merchant_id, analysis_id, finding_code,
            service_category_id, partner_offer_id, status, source, plan_snapshot,
            commission_snapshot_json, commission_earned_halala, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'eligible', ?, ?, NULL, NULL, ?, ?)
          ON CONFLICT(user_id, analysis_id, finding_code, service_category_id) DO NOTHING`,
          params: [
            row.id, row.context.userId, row.context.merchantId, row.context.id,
            row.finding.findingCode, row.category.id, row.offer.id,
            row.context.analyzerVersion, row.context.plan, row.now, row.now,
          ],
        },
        {
          sql: `INSERT INTO referral_daily_metrics (
            day_start, service_category_id, partner_offer_id, plan_snapshot,
            referrals_count, shown_count, clicks_count, unique_clickers_count
          ) VALUES (CAST(? / 86400000 AS INTEGER) * 86400000, ?, ?, ?, changes(), 0, 0, 0)
          ON CONFLICT(day_start, service_category_id, partner_offer_id, plan_snapshot)
          DO UPDATE SET referrals_count = referrals_count + excluded.referrals_count`,
          params: [row.now, row.category.id, row.offer.id, row.context.plan],
        },
      ]));
    },

    loadOwnedReferral: async (userId: string, referralId: string) => {
      return db.prepare(`
        SELECT r.*, c.active AS category_active,
          o.partner_url, o.status AS offer_status, o.quality_status
        FROM service_referrals r
        JOIN service_categories c ON c.id = r.service_category_id
        JOIN partner_offers o ON o.id = r.partner_offer_id
        WHERE r.id = ? AND r.user_id = ?
        LIMIT 1
      `).get(referralId, userId);
    },

    recordShown: async (row: Record<string, unknown>, eventId: string, now: number) => {
      await db.batch([
        {
          sql: `INSERT OR IGNORE INTO referral_events (
            id, referral_id, user_id, merchant_id, analysis_id, finding_code,
            service_category_id, partner_offer_id, plan_snapshot, event_type, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'shown', ?)`,
          params: [eventId, row.id, row.user_id, row.merchant_id, row.analysis_id,
            row.finding_code, row.service_category_id, row.partner_offer_id,
            row.plan_snapshot, now],
        },
        {
          sql: `INSERT INTO referral_daily_metrics (
            day_start, service_category_id, partner_offer_id, plan_snapshot,
            referrals_count, shown_count, clicks_count, unique_clickers_count
          ) VALUES (CAST(? / 86400000 AS INTEGER) * 86400000, ?, ?, ?, 0, changes(), 0, 0)
          ON CONFLICT(day_start, service_category_id, partner_offer_id, plan_snapshot)
          DO UPDATE SET shown_count = shown_count + excluded.shown_count`,
          params: [now, row.service_category_id, row.partner_offer_id, row.plan_snapshot],
        },
        {
          sql: `UPDATE service_referrals SET status = 'shown', updated_at = ?
            WHERE id = ? AND user_id = ? AND status = 'eligible'`,
          params: [now, row.id, row.user_id],
        },
        ...audienceOperations('viewer', row, now),
      ]);
    },

    recordClick: async (row: Record<string, unknown>, eventId: string, now: number) => {
      await db.batch([
        {
          sql: `INSERT INTO referral_events (
            id, referral_id, user_id, merchant_id, analysis_id, finding_code,
            service_category_id, partner_offer_id, plan_snapshot, event_type, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'clicked', ?)`,
          params: [eventId, row.id, row.user_id, row.merchant_id, row.analysis_id,
            row.finding_code, row.service_category_id, row.partner_offer_id,
            row.plan_snapshot, now],
        },
        {
          sql: `INSERT INTO referral_daily_metrics (
            day_start, service_category_id, partner_offer_id, plan_snapshot,
            referrals_count, shown_count, clicks_count, unique_clickers_count
          ) VALUES (CAST(? / 86400000 AS INTEGER) * 86400000, ?, ?, ?, 0, 0, 1, 0)
          ON CONFLICT(day_start, service_category_id, partner_offer_id, plan_snapshot)
          DO UPDATE SET clicks_count = clicks_count + 1`,
          params: [now, row.service_category_id, row.partner_offer_id, row.plan_snapshot],
        },
        {
          sql: `INSERT OR IGNORE INTO referral_unique_clickers (
            referral_id, user_id, service_category_id, partner_offer_id,
            plan_snapshot, first_clicked_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          params: [row.id, row.user_id, row.service_category_id,
            row.partner_offer_id, row.plan_snapshot, now],
        },
        {
          sql: `INSERT INTO referral_daily_metrics (
            day_start, service_category_id, partner_offer_id, plan_snapshot,
            referrals_count, shown_count, clicks_count, unique_clickers_count
          ) VALUES (CAST(? / 86400000 AS INTEGER) * 86400000, ?, ?, ?, 0, 0, 0, changes())
          ON CONFLICT(day_start, service_category_id, partner_offer_id, plan_snapshot)
          DO UPDATE SET unique_clickers_count =
            unique_clickers_count + excluded.unique_clickers_count`,
          params: [now, row.service_category_id, row.partner_offer_id, row.plan_snapshot],
        },
        {
          sql: `UPDATE service_referrals SET status = 'clicked', updated_at = ?
            WHERE id = ? AND user_id = ? AND status IN ('eligible', 'shown', 'clicked')`,
          params: [now, row.id, row.user_id],
        },
        ...audienceOperations('clicker', row, now),
      ]);
    },
  };
}

function audienceOperations(
  audienceKind: 'viewer' | 'clicker',
  row: Record<string, unknown>,
  now: number
): Array<{ sql: string; params: unknown[] }> {
  return (['day', 'month'] as const).flatMap((periodKind) => {
    const periodStart = periodKind === 'day'
      ? 'CAST(? / 86400000 AS INTEGER) * 86400000'
      : "CAST(strftime('%s', datetime(? / 1000, 'unixepoch'), 'start of month') AS INTEGER) * 1000";
    return [
      {
        sql: `INSERT OR IGNORE INTO referral_unique_audience (
          audience_kind, period_kind, period_start, user_id,
          service_category_id, partner_offer_id, plan_snapshot, first_event_at
        ) VALUES (?, ?, ${periodStart}, ?, ?, ?, ?, ?)`,
        params: [audienceKind, periodKind, now, row.user_id,
          row.service_category_id, row.partner_offer_id, row.plan_snapshot, now],
      },
      {
        sql: `INSERT INTO referral_audience_metrics (
          audience_kind, period_kind, period_start, service_category_id,
          partner_offer_id, plan_snapshot, unique_users_count
        ) VALUES (?, ?, ${periodStart}, ?, ?, ?, changes())
        ON CONFLICT(audience_kind, period_kind, period_start,
          service_category_id, partner_offer_id, plan_snapshot)
        DO UPDATE SET unique_users_count =
          unique_users_count + excluded.unique_users_count`,
        params: [audienceKind, periodKind, now, row.service_category_id,
          row.partner_offer_id, row.plan_snapshot],
      },
    ];
  });
}

export async function getReferralRepository() {
  return createReferralRepository(await getDb() as ReferralDb);
}
