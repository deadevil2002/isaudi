import { getDb } from '@/lib/db/client';
import type {
  LandingAnalysisFailureReason,
  LandingPageAnalysisResult,
} from './types';

type LandingAnalysisRow = {
  id: string;
  user_id: string;
  merchant_id: string;
  storefront_origin: string;
  final_url: string;
  content_hash: string;
  analyzer_version: string;
  status: 'succeeded' | 'insufficient_evidence';
  evidence_json: string;
  findings_json: string;
  fetch_duration_ms: number;
  analysis_duration_ms: number;
  analyzed_at: number;
};

type LandingDb = {
  prepare(sql: string): {
    get(...params: unknown[]): Promise<unknown>;
    run(...params: unknown[]): Promise<unknown>;
  };
};

export interface LandingAnalysisRepository {
  getCached(input: {
    userId: string;
    merchantId: string;
    storefrontOrigin: string;
    contentHash: string;
    analyzerVersion: string;
  }): Promise<LandingPageAnalysisResult | null>;
  save(result: LandingPageAnalysisResult): Promise<LandingPageAnalysisResult>;
  recordFailure(input: {
    id: string;
    userId: string;
    merchantId: string;
    storefrontOrigin: string;
    analyzerVersion: string;
    reason: LandingAnalysisFailureReason;
    httpStatus: number | null;
    fetchDurationMs: number;
    analyzedAt: number;
  }): Promise<void>;
}

function parseStored(row: LandingAnalysisRow, cached: boolean): LandingPageAnalysisResult {
  const stored = JSON.parse(row.evidence_json) as {
    evidence: LandingPageAnalysisResult['evidence'];
    categories: LandingPageAnalysisResult['categories'];
  };
  const findings = JSON.parse(row.findings_json) as LandingPageAnalysisResult['findings'];
  if (!stored?.evidence || !stored.categories || !Array.isArray(findings)) {
    throw new Error('Stored landing-page analysis is invalid');
  }
  return {
    id: row.id,
    userId: row.user_id,
    merchantId: row.merchant_id,
    storefrontOrigin: row.storefront_origin,
    finalUrl: row.final_url,
    contentHash: row.content_hash,
    analyzerVersion: row.analyzer_version as LandingPageAnalysisResult['analyzerVersion'],
    analyzedAt: row.analyzed_at,
    status: row.status,
    cached,
    fetchDurationMs: row.fetch_duration_ms,
    analysisDurationMs: row.analysis_duration_ms,
    evidence: stored.evidence,
    findings,
    categories: stored.categories,
    aiAssisted: false,
    browserRendered: false,
  };
}

export function createLandingAnalysisRepository(db: LandingDb): LandingAnalysisRepository {
  const selectCached = async (input: {
    userId: string;
    merchantId: string;
    storefrontOrigin: string;
    contentHash: string;
    analyzerVersion: string;
  }, cached: boolean): Promise<LandingPageAnalysisResult | null> => {
    const row = await db.prepare(`
      SELECT id, user_id, merchant_id, storefront_origin, final_url,
        content_hash, analyzer_version, status, evidence_json, findings_json,
        fetch_duration_ms, analysis_duration_ms, analyzed_at
      FROM landing_page_analyses
      WHERE user_id = ? AND merchant_id = ? AND storefront_origin = ?
        AND content_hash = ? AND analyzer_version = ?
        AND status IN ('succeeded', 'insufficient_evidence')
      LIMIT 1
    `).get(
      input.userId,
      input.merchantId,
      input.storefrontOrigin,
      input.contentHash,
      input.analyzerVersion
    ) as LandingAnalysisRow | undefined;
    return row ? parseStored(row, cached) : null;
  };

  return {
    getCached: async (input) => {
      const existing = await selectCached(input, true);
      if (!existing) return null;
      await db.prepare(`
        UPDATE landing_page_analyses
        SET cache_hits = cache_hits + 1, last_accessed_at = ?
        WHERE id = ? AND user_id = ? AND merchant_id = ?
      `).run(Date.now(), existing.id, input.userId, input.merchantId);
      return existing;
    },
    save: async (result) => {
      await db.prepare(`
        INSERT INTO landing_page_analyses (
          id, user_id, merchant_id, storefront_origin, final_url,
          content_hash, analyzer_version, status, failure_reason, http_status,
          evidence_json, findings_json, finding_count,
          fetch_duration_ms, analysis_duration_ms, browser_rendered,
          ai_assisted, cache_hits, analyzed_at, last_accessed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
        ON CONFLICT(user_id, merchant_id, storefront_origin, content_hash, analyzer_version)
        DO NOTHING
      `).run(
        result.id,
        result.userId,
        result.merchantId,
        result.storefrontOrigin,
        result.finalUrl,
        result.contentHash,
        result.analyzerVersion,
        result.status,
        result.evidence.page.httpStatus,
        JSON.stringify({ evidence: result.evidence, categories: result.categories }),
        JSON.stringify(result.findings),
        result.findings.length,
        result.fetchDurationMs,
        result.analysisDurationMs,
        result.analyzedAt,
        result.analyzedAt
      );
      return (await selectCached({
        userId: result.userId,
        merchantId: result.merchantId,
        storefrontOrigin: result.storefrontOrigin,
        contentHash: result.contentHash,
        analyzerVersion: result.analyzerVersion,
      }, false)) ?? result;
    },
    recordFailure: async (input) => {
      await db.prepare(`
        INSERT INTO landing_page_analyses (
          id, user_id, merchant_id, storefront_origin, final_url,
          content_hash, analyzer_version, status, failure_reason, http_status,
          evidence_json, findings_json, finding_count,
          fetch_duration_ms, analysis_duration_ms, browser_rendered,
          ai_assisted, cache_hits, analyzed_at, last_accessed_at
        ) VALUES (?, ?, ?, ?, NULL, NULL, ?, 'failed', ?, ?, NULL, NULL, 0, ?, 0, 0, 0, 0, ?, ?)
      `).run(
        input.id,
        input.userId,
        input.merchantId,
        input.storefrontOrigin,
        input.analyzerVersion,
        input.reason,
        input.httpStatus,
        input.fetchDurationMs,
        input.analyzedAt,
        input.analyzedAt
      );
    },
  };
}

export async function getLandingAnalysisRepository(): Promise<LandingAnalysisRepository> {
  return createLandingAnalysisRepository(await getDb() as LandingDb);
}
