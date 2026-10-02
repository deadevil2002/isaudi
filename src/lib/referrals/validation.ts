import { isIP } from 'node:net';
import { isInternalStorefrontHostname } from '@/lib/salla/storefront-origin';
import type {
  CommissionType,
  PartnerOfferStatus,
  PartnerQualityStatus,
} from './types';

const PLATFORM_VALUES = new Set(['salla']);

export function boundedText(value: unknown, max: number, required = true): string {
  if (typeof value !== 'string') throw new Error('invalid_text');
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  if ((required && !normalized) || normalized.length > max) throw new Error('invalid_text');
  return normalized;
}
export function normalizePartnerUrl(value: unknown): string {
  const raw = boundedText(value, 2048);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('invalid_partner_url');
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !hostname ||
    isIP(hostname) !== 0 ||
    isInternalStorefrontHostname(hostname)
  ) {
    throw new Error('invalid_partner_url');
  }
  parsed.hash = '';
  return parsed.href;
}

export function parsePlatforms(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('invalid_platforms');
  const platforms = [...new Set(value.map((item) => String(item).trim().toLowerCase()))];
  if (!platforms.length || platforms.some((item) => !PLATFORM_VALUES.has(item))) {
    throw new Error('invalid_platforms');
  }
  return platforms;
}

export function parseStatus(value: unknown): PartnerOfferStatus {
  if (value !== 'active' && value !== 'inactive' && value !== 'suspended') {
    throw new Error('invalid_status');
  }
  return value;
}

export function parseQualityStatus(value: unknown): PartnerQualityStatus {
  if (value !== 'approved' && value !== 'review' && value !== 'rejected') {
    throw new Error('invalid_quality_status');
  }
  return value;
}

export function parseCommission(input: Record<string, unknown>): {
  commissionType: CommissionType;
  commissionRateBps: number | null;
  fixedAmountHalala: number | null;
  commissionCurrency: string | null;
} {
  if (input.commissionType === 'percentage') {
    const rate = Number(input.commissionRateBps);
    if (!Number.isInteger(rate) || rate < 0 || rate > 10000) throw new Error('invalid_commission');
    return {
      commissionType: 'percentage', commissionRateBps: rate,
      fixedAmountHalala: null, commissionCurrency: null,
    };
  }
  if (input.commissionType === 'fixed') {
    const amount = Number(input.fixedAmountHalala);
    const currency = boundedText(input.commissionCurrency, 3).toUpperCase();
    if (!Number.isInteger(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) {
      throw new Error('invalid_commission');
    }
    return {
      commissionType: 'fixed', commissionRateBps: null,
      fixedAmountHalala: amount, commissionCurrency: currency,
    };
  }
  throw new Error('invalid_commission');
}
