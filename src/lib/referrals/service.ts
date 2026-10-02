import { findingPassesThresholds, mapFindingToCategory, rankFindings } from './mapping';
import { getReferralRepository } from './repository';
import type { CustomerReferral, ReferralEligibilityResult } from './types';
import { normalizePartnerUrl } from './validation';

export class ReferralAccessError extends Error {
  constructor(readonly status: number, readonly reason: string) {
    super(reason);
    this.name = 'ReferralAccessError';
  }
}

type ReferralRepository = Awaited<ReturnType<typeof getReferralRepository>>;

export async function getEligibleReferrals(input: {
  userId: string;
  analysisId: string;
  repository?: ReferralRepository;
  createId?: () => string;
  now?: () => number;
}): Promise<ReferralEligibilityResult> {
  const repository = input.repository ?? await getReferralRepository();
  const context = await repository.loadAnalysisContext(input.userId, input.analysisId);
  if (!context) throw new ReferralAccessError(404, 'analysis_not_found');
  if (context.status !== 'succeeded') {
    return { analysisId: context.id, referrals: [], reason: 'no_findings' };
  }

  const existing = await repository.loadActiveReferrals(
    input.userId, input.analysisId, context.findings
  );
  if (existing.length) {
    return { analysisId: context.id, referrals: existing, reason: 'eligible' };
  }
  if (!context.findings.length) {
    return { analysisId: context.id, referrals: [], reason: 'no_findings' };
  }

  const mapped = rankFindings(context.findings).flatMap((finding) => {
    const slug = mapFindingToCategory(finding);
    return slug ? [{ finding, slug }] : [];
  });
  if (!mapped.length) return { analysisId: context.id, referrals: [], reason: 'no_mapping' };

  let sawInactive = false;
  let sawThresholdFailure = false;
  let sawPartnerUnavailable = false;
  let sawLimit = false;
  const pending: Parameters<ReferralRepository['createReferrals']>[0] = [];
  const configurationCache = new Map<string, Awaited<ReturnType<ReferralRepository['loadConfiguration']>>>();

  for (const item of mapped) {
    let configuration = configurationCache.get(item.slug);
    if (configuration === undefined) {
      configuration = await repository.loadConfiguration(item.slug);
      configurationCache.set(item.slug, configuration);
    }
    if (!configuration?.category.active) {
      sawInactive = true;
      continue;
    }
    if (!findingPassesThresholds(item.finding, configuration.category)) {
      sawThresholdFailure = true;
      continue;
    }
    const alreadyForCategory = pending.filter(
      (row) => row.category.id === configuration!.category.id
    ).length;
    if (alreadyForCategory >= configuration.category.maxReferralsPerAnalysis) {
      sawLimit = true;
      continue;
    }
    const offer = configuration.offers.find((candidate) =>
      candidate.supportedPlatforms.includes(context.platform)
    );
    if (!offer) {
      sawPartnerUnavailable = true;
      continue;
    }
    pending.push({
      id: input.createId ? input.createId() : crypto.randomUUID(),
      context,
      finding: item.finding,
      category: configuration.category,
      offer,
      now: (input.now ?? Date.now)(),
    });
  }

  await repository.createReferrals(pending);
  const referrals = await repository.loadActiveReferrals(
    input.userId, input.analysisId, context.findings
  );
  if (referrals.length) return { analysisId: context.id, referrals, reason: 'eligible' };
  const reason = sawPartnerUnavailable ? 'partner_unavailable'
    : sawInactive ? 'category_inactive'
    : sawThresholdFailure ? 'threshold_not_met'
    : sawLimit ? 'limit_reached'
    : 'no_mapping';
  return { analysisId: context.id, referrals: [], reason };
}

async function loadUsableReferral(
  repository: ReferralRepository,
  userId: string,
  referralId: string
) {
  const row = await repository.loadOwnedReferral(userId, referralId);
  if (!row) throw new ReferralAccessError(404, 'referral_not_found');
  return row;
}

export async function markReferralShown(input: {
  userId: string;
  referralId: string;
  repository?: ReferralRepository;
  createId?: () => string;
  now?: () => number;
}): Promise<void> {
  const repository = input.repository ?? await getReferralRepository();
  const row = await loadUsableReferral(repository, input.userId, input.referralId);
  await repository.recordShown(
    row,
    input.createId ? input.createId() : crypto.randomUUID(),
    (input.now ?? Date.now)()
  );
}

export async function registerReferralClick(input: {
  userId: string;
  referralId: string;
  repository?: ReferralRepository;
  createId?: () => string;
  now?: () => number;
}): Promise<string> {
  const repository = input.repository ?? await getReferralRepository();
  const row = await loadUsableReferral(repository, input.userId, input.referralId);
  if (
    Number(row.category_active) !== 1 ||
    row.offer_status !== 'active' ||
    row.quality_status !== 'approved'
  ) {
    throw new ReferralAccessError(410, 'referral_unavailable');
  }
  const destination = normalizePartnerUrl(row.partner_url);
  await repository.recordClick(
    row,
    input.createId ? input.createId() : crypto.randomUUID(),
    (input.now ?? Date.now)()
  );
  return destination;
}

export function referralByFinding(
  referrals: CustomerReferral[]
): Map<string, CustomerReferral> {
  return new Map(referrals.map((referral) => [referral.findingCode, referral]));
}
