import type {
  LandingFinding,
  LandingFindingConfidence,
  LandingFindingSeverity,
} from '@/lib/landing-page/types';
import type { ServiceCategorySlug } from './types';

const FINDING_CATEGORY_MAP: Readonly<Record<string, ServiceCategorySlug>> = Object.freeze({
  'landing.heading.h1_missing.v1': 'landing_page_optimization',
  'landing.cta.missing.v1': 'landing_page_optimization',
  'landing.cta.competing_actions.v1': 'landing_page_optimization',
  'landing.image.obvious_broken_source.v1': 'landing_page_optimization',
  'landing.mobile.fixed_width_risk.v1': 'landing_page_optimization',
  'landing.trust.signals_absent.v1': 'landing_page_optimization',
});

const CONFIDENCE_ORDER: Record<LandingFindingConfidence, number> = {
  low: 1, medium: 2, high: 3,
};
const SEVERITY_ORDER: Record<LandingFindingSeverity, number> = {
  low: 1, medium: 2, high: 3, critical: 4,
};

export function mapFindingToCategory(finding: LandingFinding): ServiceCategorySlug | null {
  const mapped = FINDING_CATEGORY_MAP[finding.findingCode] ?? null;
  return mapped && finding.eligibleServiceCategories.includes(mapped) ? mapped : null;
}

export function findingPassesThresholds(
  finding: LandingFinding,
  thresholds: {
    minimumConfidence: LandingFindingConfidence;
    minimumSeverity: LandingFindingSeverity;
  }
): boolean {
  return finding.evidence.length > 0 &&
    CONFIDENCE_ORDER[finding.confidence] >= CONFIDENCE_ORDER[thresholds.minimumConfidence] &&
    SEVERITY_ORDER[finding.severity] >= SEVERITY_ORDER[thresholds.minimumSeverity];
}

export function rankFindings(findings: LandingFinding[]): LandingFinding[] {
  return [...findings].sort((left, right) =>
    SEVERITY_ORDER[right.severity] - SEVERITY_ORDER[left.severity] ||
    CONFIDENCE_ORDER[right.confidence] - CONFIDENCE_ORDER[left.confidence] ||
    left.findingCode.localeCompare(right.findingCode)
  );
}

export function supportedFindingCodes(): string[] {
  return Object.keys(FINDING_CATEGORY_MAP);
}
