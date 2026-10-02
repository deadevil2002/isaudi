import { getDb } from '@/lib/db/client';
import type { ReferralDb } from './repository';
import { boundedText } from './validation';
import { ReferralAdminError } from './admin';

type AdminIdentity = { id: string; role: string };
type ConversionStatus = 'pending' | 'submitted' | 'verified' | 'rejected' | 'cancelled';

const MAX_AMOUNT_HALALA = 1_000_000_000_000;

function requireSuperAdmin(admin: AdminIdentity) {
  if (admin.role !== 'super_admin') throw new ReferralAdminError(403, 'forbidden');
}

function safeText(value: unknown, max: number): string {
  try {
    return boundedText(value, max);
  } catch {
    throw new ReferralAdminError(400, 'invalid_input');
  }
}

function optionalMoney(amount: unknown, currency: unknown) {
  if (amount == null || amount === '') {
    if (currency != null && currency !== '') throw new ReferralAdminError(400, 'invalid_amount');
    return { amountHalala: null, currency: null };
  }
  const amountHalala = Number(amount);
  const normalizedCurrency = safeText(currency, 3).toUpperCase();
  if (
    !Number.isSafeInteger(amountHalala) || amountHalala < 0 ||
    amountHalala > MAX_AMOUNT_HALALA || !/^[A-Z]{3}$/.test(normalizedCurrency)
  ) {
    throw new ReferralAdminError(400, 'invalid_amount');
  }
  return { amountHalala, currency: normalizedCurrency };
}

function auditOperation(input: {
  id: string;
  adminId: string;
  action: string;
  ipHash: string | null;
  conversionId: string;
  metadata: Record<string, string | number | boolean>;
  now: number;
}) {
  return {
    sql: `INSERT INTO admin_audit_log
      (id, admin_id, action, target_type, target_id, ip_hash, metadata_json, created_at)
      VALUES (?, ?, ?, 'referral_conversion', ?, ?, ?, ?)`,
    params: [input.id, input.adminId, input.action, input.conversionId, input.ipHash,
      JSON.stringify(input.metadata), input.now],
  };
}

export async function submitManualConversion(input: {
  admin: AdminIdentity;
  data: Record<string, unknown>;
  ipHash?: string | null;
  db?: ReferralDb;
  createId?: () => string;
  now?: () => number;
}) {
  requireSuperAdmin(input.admin);
  const db = input.db ?? await getDb() as ReferralDb;
  const referralId = safeText(input.data.referralId, 128);
  const externalReference = safeText(input.data.externalReference, 160);
  const now = (input.now ?? Date.now)();
  const convertedAt = Number(input.data.convertedAt);
  if (!Number.isSafeInteger(convertedAt) || convertedAt <= 0 || convertedAt > now + 300_000) {
    throw new ReferralAdminError(400, 'invalid_converted_at');
  }
  const money = optionalMoney(input.data.amountHalala, input.data.currency);
  const referral = await db.prepare(`SELECT id, user_id, merchant_id, analysis_id,
    finding_code, service_category_id, partner_offer_id, plan_snapshot, status
    FROM service_referrals WHERE id=? LIMIT 1`).get(referralId);
  if (!referral) throw new ReferralAdminError(404, 'referral_not_found');
  if (referral.status === 'converted' || referral.status === 'cancelled') {
    throw new ReferralAdminError(409, 'referral_not_convertible');
  }
  if (await db.prepare(`SELECT id FROM referral_conversions
    WHERE referral_id=? OR (partner_offer_id=? AND external_reference=?) LIMIT 1`)
    .get(referralId, referral.partner_offer_id, externalReference)) {
    throw new ReferralAdminError(409, 'duplicate_conversion');
  }
  const createId = input.createId ?? (() => crypto.randomUUID());
  const id = createId();
  await db.batch([
    {
      sql: `INSERT INTO referral_conversions (
        id, referral_id, user_id, merchant_id, analysis_id, finding_code,
        service_category_id, partner_offer_id, plan_snapshot, status, source,
        external_reference, converted_at, submitted_at, amount_halala, currency,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted',
        'manual_admin_verification', ?, ?, ?, ?, ?, ?, ?)`,
      params: [id, referral.id, referral.user_id, referral.merchant_id,
        referral.analysis_id, referral.finding_code, referral.service_category_id,
        referral.partner_offer_id, referral.plan_snapshot, externalReference,
        convertedAt, now, money.amountHalala, money.currency, now, now],
    },
    auditOperation({
      id: createId(), adminId: input.admin.id, action: 'referral_conversion_submitted',
      ipHash: input.ipHash ?? null, conversionId: id,
      metadata: { old_status: 'none', new_status: 'submitted', external_reference: externalReference },
      now,
    }),
  ]);
  return { id, status: 'submitted' as const };
}

function percentageCommission(base: number, rateBps: number): number {
  if (!Number.isSafeInteger(base) || !Number.isSafeInteger(rateBps)) {
    throw new ReferralAdminError(400, 'invalid_commission');
  }
  return Math.floor((base * rateBps + 5_000) / 10_000);
}

export async function verifyManualConversion(input: {
  admin: AdminIdentity;
  conversionId: string;
  ipHash?: string | null;
  db?: ReferralDb;
  createId?: () => string;
  now?: () => number;
}) {
  requireSuperAdmin(input.admin);
  const db = input.db ?? await getDb() as ReferralDb;
  const conversionId = safeText(input.conversionId, 128);
  const row = await db.prepare(`SELECT x.*, o.commission_type, o.commission_rate_bps,
    o.fixed_amount_halala, o.commission_currency, o.commission_basis
    FROM referral_conversions x
    JOIN partner_offers o ON o.id=x.partner_offer_id
    WHERE x.id=? LIMIT 1`).get(conversionId);
  if (!row) throw new ReferralAdminError(404, 'conversion_not_found');
  if (row.status !== 'pending' && row.status !== 'submitted') {
    throw new ReferralAdminError(409, 'invalid_conversion_transition');
  }
  if (!row.commission_basis) throw new ReferralAdminError(409, 'commission_basis_not_configured');
  if (await db.prepare('SELECT id FROM referral_commissions WHERE conversion_id=? LIMIT 1')
    .get(conversionId)) throw new ReferralAdminError(409, 'duplicate_commission');

  const type = String(row.commission_type);
  const baseAmount = row.amount_halala == null ? null : Number(row.amount_halala);
  let commissionAmount: number;
  let currency: string;
  if (type === 'percentage') {
    if (baseAmount == null || !row.currency) throw new ReferralAdminError(409, 'conversion_amount_required');
    commissionAmount = percentageCommission(baseAmount, Number(row.commission_rate_bps));
    currency = String(row.currency);
  } else if (type === 'fixed') {
    commissionAmount = Number(row.fixed_amount_halala);
    currency = String(row.commission_currency);
  } else {
    throw new ReferralAdminError(409, 'invalid_commission_configuration');
  }
  const now = (input.now ?? Date.now)();
  const createId = input.createId ?? (() => crypto.randomUUID());
  const commissionId = createId();
  const snapshot = JSON.stringify({
    type,
    rateBps: row.commission_rate_bps == null ? null : Number(row.commission_rate_bps),
    fixedAmountHalala: row.fixed_amount_halala == null ? null : Number(row.fixed_amount_halala),
    basis: String(row.commission_basis),
    baseAmountHalala: baseAmount,
    currency,
    commissionAmountHalala: commissionAmount,
  });
  await db.batch([
    {
      sql: `UPDATE referral_conversions SET status='verified', verified_at=?,
        verified_by_admin_id=?, updated_at=? WHERE id=? AND status IN ('pending','submitted')`,
      params: [now, input.admin.id, now, conversionId],
    },
    {
      sql: `INSERT INTO referral_commissions (
        id, conversion_id, referral_id, service_category_id, partner_offer_id,
        plan_snapshot, status, commission_type_snapshot,
        commission_rate_bps_snapshot, fixed_amount_halala_snapshot,
        commission_basis_snapshot, base_amount_halala, commission_amount_halala,
        currency, earned_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'earned', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [commissionId, conversionId, row.referral_id, row.service_category_id,
        row.partner_offer_id, row.plan_snapshot, type, row.commission_rate_bps,
        row.fixed_amount_halala, row.commission_basis, baseAmount,
        commissionAmount, currency, now, now, now],
    },
    {
      sql: `UPDATE service_referrals SET status='converted', commission_snapshot_json=?,
        commission_earned_halala=?, updated_at=? WHERE id=?`,
      params: [snapshot, commissionAmount, now, row.referral_id],
    },
    {
      sql: `INSERT INTO referral_events (
        id, referral_id, user_id, merchant_id, analysis_id, finding_code,
        service_category_id, partner_offer_id, plan_snapshot, event_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'converted', ?)`,
      params: [createId(), row.referral_id, row.user_id, row.merchant_id,
        row.analysis_id, row.finding_code, row.service_category_id,
        row.partner_offer_id, row.plan_snapshot, now],
    },
    auditOperation({
      id: createId(), adminId: input.admin.id, action: 'referral_conversion_verified',
      ipHash: input.ipHash ?? null, conversionId,
      metadata: { old_status: String(row.status), new_status: 'verified',
        external_reference: String(row.external_reference), commission_id: commissionId },
      now,
    }),
  ]);
  return { id: conversionId, status: 'verified' as const, commissionId };
}

export async function closeManualConversion(input: {
  admin: AdminIdentity;
  conversionId: string;
  status: Extract<ConversionStatus, 'rejected' | 'cancelled'>;
  ipHash?: string | null;
  db?: ReferralDb;
  createId?: () => string;
  now?: () => number;
}) {
  requireSuperAdmin(input.admin);
  const db = input.db ?? await getDb() as ReferralDb;
  const conversionId = safeText(input.conversionId, 128);
  const row = await db.prepare('SELECT status FROM referral_conversions WHERE id=? LIMIT 1')
    .get(conversionId);
  if (!row) throw new ReferralAdminError(404, 'conversion_not_found');
  if (row.status !== 'pending' && row.status !== 'submitted') {
    throw new ReferralAdminError(409, 'invalid_conversion_transition');
  }
  const now = (input.now ?? Date.now)();
  const createId = input.createId ?? (() => crypto.randomUUID());
  const column = input.status === 'rejected' ? 'rejected' : 'cancelled';
  await db.batch([
    {
      sql: `UPDATE referral_conversions SET status=?, ${column}_at=?,
        ${column}_by_admin_id=?, updated_at=? WHERE id=? AND status IN ('pending','submitted')`,
      params: [input.status, now, input.admin.id, now, conversionId],
    },
    auditOperation({
      id: createId(), adminId: input.admin.id,
      action: `referral_conversion_${input.status}`, ipHash: input.ipHash ?? null,
      conversionId, metadata: { old_status: String(row.status), new_status: input.status }, now,
    }),
  ]);
  return { id: conversionId, status: input.status };
}
