export const LANDING_PAGE_ANALYZER_VERSION = 'landing_page_analyzer_v1';

export type LandingAnalysisStatus =
  | 'succeeded'
  | 'failed'
  | 'insufficient_evidence';

export type LandingFindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type LandingFindingConfidence = 'low' | 'medium' | 'high';
export type LandingFindingSource = 'deterministic' | 'ai' | 'hybrid';

export interface LandingEvidence {
  signal: string;
  observed: string | number | boolean;
  expected?: string | number | boolean;
}

export interface LandingFinding {
  findingCode: string;
  title: string;
  description: string;
  evidence: LandingEvidence[];
  potentialImpact: string;
  recommendation: string;
  confidence: LandingFindingConfidence;
  severity: LandingFindingSeverity;
  source: LandingFindingSource;
  analyzerVersion: typeof LANDING_PAGE_ANALYZER_VERSION;
  eligibleServiceCategories: string[];
}

export interface LandingPageEvidencePack {
  page: {
    httpStatus: number;
    https: true;
    title: string | null;
    description: string | null;
    canonical: string | null;
    indexability: 'indexable' | 'noindex' | 'unknown';
    language: string | null;
  };
  headings: {
    h1Count: number;
    h1Text: string[];
    hierarchySkips: number;
  };
  hero: {
    headline: string | null;
    supportingText: string | null;
    ctaPresent: boolean;
  };
  cta: {
    count: number;
    distinctTextCount: number;
    items: Array<{ text: string; href: string | null; location: string }>;
  };
  content: {
    visibleTextLength: number;
    valuePropositionSignals: number;
    productSignals: number;
    categorySignals: number;
    trustSignals: string[];
    contactSignals: string[];
    shippingSignals: string[];
    returnsSignals: string[];
    paymentSignals: string[];
    reviewSignals: string[];
    businessType: 'unknown';
  };
  images: {
    count: number;
    missingAlt: number;
    obviousBroken: number;
    largeDimensionIndicators: number;
  };
  mobile: {
    viewportConfigured: boolean;
    fixedWidthOverflowRisks: number;
    ctaVisibility: 'unavailable_without_rendering';
    navigationAssessment: 'unavailable_without_rendering';
    exact390x844Measured: false;
    reason: 'browser_rendering_not_used';
  };
  accessibility: {
    unlabeledFormControls: number;
    buttonLikeNonSemanticElements: number;
  };
  performance: {
    resourceCount: number;
    blockingScriptCount: number;
    measuredCoreWebVitals: false;
  };
  rendering: {
    used: false;
    required: boolean;
    reason: 'deterministic_html_sufficient' | 'javascript_content_requires_rendering';
  };
  promptInjection: {
    treatedAsData: true;
    suspiciousInstructionSignals: number;
  };
}

export interface LandingPageAnalysisResult {
  id: string;
  userId: string;
  merchantId: string;
  storefrontOrigin: string;
  finalUrl: string;
  contentHash: string;
  analyzerVersion: typeof LANDING_PAGE_ANALYZER_VERSION;
  analyzedAt: number;
  status: Exclude<LandingAnalysisStatus, 'failed'>;
  cached: boolean;
  fetchDurationMs: number;
  analysisDurationMs: number;
  evidence: LandingPageEvidencePack;
  findings: LandingFinding[];
  categories: Record<
    'clarity' | 'cta' | 'trust' | 'mobile' | 'seo' | 'accessibility' | 'performance' | 'contentHierarchy',
    'good' | 'attention' | 'unavailable' | 'insufficient_evidence'
  >;
  aiAssisted: false;
  browserRendered: false;
}

export type LandingAnalysisFailureReason =
  | 'verified_storefront_unavailable'
  | 'invalid_verified_origin'
  | 'dns_nxdomain'
  | 'dns_no_public_address'
  | 'dns_timeout'
  | 'dns_resolution_error'
  | 'dns_unsupported_runtime'
  | 'redirect_rejected'
  | 'too_many_redirects'
  | 'fetch_timeout'
  | 'fetch_network_error'
  | 'http_error'
  | 'content_type_rejected'
  | 'response_too_large';

export class LandingPageFetchError extends Error {
  constructor(
    readonly reason: LandingAnalysisFailureReason,
    message: string,
    readonly httpStatus: number | null = null
  ) {
    super(message);
    this.name = 'LandingPageFetchError';
  }
}
