import { randomUUID } from 'node:crypto';
import { getStoreInfo, type SallaStoreInfo } from '@/lib/salla/client';
import { getVerifiedSallaStorefront } from '@/lib/salla/repository';
import {
  normalizeTrustedStorefrontOrigin,
  normalizeTrustedStorefrontUrl,
} from '@/lib/salla/storefront-origin';
import type { VerifiedSallaStorefront } from '@/lib/salla/types';
import { analyzeStorefrontHtml } from './html-analyzer';
import { fetchVerifiedStorefront, type StorefrontResolver } from './safe-fetch';
import {
  getLandingAnalysisRepository,
  type LandingAnalysisRepository,
} from './repository';
import {
  LANDING_PAGE_ANALYZER_VERSION,
  LandingPageFetchError,
  type LandingAnalysisFailureReason,
  type LandingPageAnalysisResult,
} from './types';

export class LandingPageAnalysisUnavailableError extends Error {
  constructor(
    readonly reason: LandingAnalysisFailureReason,
    readonly httpStatus: number | null = null
  ) {
    super('Landing-page analysis unavailable');
    this.name = 'LandingPageAnalysisUnavailableError';
  }
}

export async function analyzeVerifiedLandingPage(input: {
  userId: string;
  merchantId: string;
  getStorefront?: (userId: string, merchantId: string) => Promise<VerifiedSallaStorefront | undefined>;
  getStoreInfo?: (userId: string, options: { merchantId: string }) => Promise<SallaStoreInfo>;
  repository?: LandingAnalysisRepository;
  fetcher?: typeof fetch;
  resolver?: StorefrontResolver;
  now?: () => number;
  createId?: () => string;
}): Promise<LandingPageAnalysisResult> {
  const now = input.now ?? Date.now;
  const createId = input.createId ?? randomUUID;
  const getStorefront = input.getStorefront ?? getVerifiedSallaStorefront;
  const storefront = await getStorefront(input.userId, input.merchantId);
  if (!storefront || storefront.userId !== input.userId || storefront.merchantId !== input.merchantId) {
    throw new LandingPageAnalysisUnavailableError('verified_storefront_unavailable');
  }

  let storeInfo: SallaStoreInfo;
  try {
    storeInfo = await (input.getStoreInfo ?? getStoreInfo)(input.userId, {
      merchantId: input.merchantId,
    });
  } catch {
    throw new LandingPageAnalysisUnavailableError('verified_storefront_unavailable');
  }
  const storefrontUrl = normalizeTrustedStorefrontUrl(storeInfo.domain);
  const storeInfoOrigin = storefrontUrl
    ? normalizeTrustedStorefrontOrigin(storefrontUrl)
    : null;
  if (
    storeInfo.merchantId !== input.merchantId ||
    !storefrontUrl ||
    !storeInfoOrigin ||
    storeInfoOrigin !== storefront.origin
  ) {
    throw new LandingPageAnalysisUnavailableError('verified_storefront_unavailable');
  }

  const repository = input.repository ?? await getLandingAnalysisRepository();
  const startedAt = now();
  let document;
  try {
    document = await fetchVerifiedStorefront(storefrontUrl, {
      fetcher: input.fetcher,
      resolver: input.resolver,
      now,
    });
  } catch (error) {
    const fetchError = error instanceof LandingPageFetchError
      ? error
      : new LandingPageFetchError('fetch_network_error', 'Storefront request failed');
    try {
      await repository.recordFailure({
        id: createId(),
        userId: input.userId,
        merchantId: input.merchantId,
        storefrontOrigin: storefront.origin,
        analyzerVersion: LANDING_PAGE_ANALYZER_VERSION,
        reason: fetchError.reason,
        httpStatus: fetchError.httpStatus,
        fetchDurationMs: Math.max(0, now() - startedAt),
        analyzedAt: now(),
      });
    } catch {
      console.error('[landing-page/analyze] Failure telemetry could not be stored');
    }
    throw new LandingPageAnalysisUnavailableError(fetchError.reason, fetchError.httpStatus);
  }

  const cacheKey = {
    userId: input.userId,
    merchantId: input.merchantId,
    storefrontOrigin: storefront.origin,
    contentHash: document.contentHash,
    analyzerVersion: LANDING_PAGE_ANALYZER_VERSION,
  };
  const cached = await repository.getCached(cacheKey);
  if (cached) return cached;

  const result = analyzeStorefrontHtml(document, {
    id: createId(),
    userId: input.userId,
    merchantId: input.merchantId,
    analyzedAt: now(),
  });
  return repository.save(result);
}
