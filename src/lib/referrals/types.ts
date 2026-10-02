import type {
  LandingFinding,
  LandingFindingConfidence,
  LandingFindingSeverity,
} from '@/lib/landing-page/types';

export const REFERRAL_SOURCE = 'landing_page_analyzer_v1';
export const REFERRAL_PLATFORM = 'salla';

export type ServiceCategorySlug = 'landing_page_optimization';
export type PartnerOfferStatus = 'active' | 'inactive' | 'suspended';
export type PartnerQualityStatus = 'approved' | 'review' | 'rejected';
export type CommissionType = 'percentage' | 'fixed';

export interface ServiceCategory {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  active: boolean;
  minimumConfidence: LandingFindingConfidence;
  minimumSeverity: LandingFindingSeverity;
  maxReferralsPerAnalysis: number;
  createdAt: number;
  updatedAt: number;
}
export interface PartnerOffer {
  id: string;
  serviceCategoryId: string;
  partnerName: string;
  partnerUrl: string;
  serviceTitleAr: string;
  serviceTitleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  supportedPlatforms: string[];
  commissionType: CommissionType;
  commissionRateBps: number | null;
  fixedAmountHalala: number | null;
  commissionCurrency: string | null;
  status: PartnerOfferStatus;
  displayPriority: number;
  qualityStatus: PartnerQualityStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CustomerReferral {
  referralId: string;
  analysisId: string;
  findingCode: string;
  finding: LandingFinding;
  category: {
    slug: string;
    nameAr: string;
    nameEn: string;
  };
  offer: {
    partnerName: string;
    serviceTitleAr: string;
    serviceTitleEn: string;
    descriptionAr: string;
    descriptionEn: string;
  };
  redirectPath: string;
  status: 'eligible' | 'shown' | 'clicked';
}

export interface ReferralEligibilityResult {
  analysisId: string;
  referrals: CustomerReferral[];
  reason:
    | 'eligible'
    | 'no_findings'
    | 'no_mapping'
    | 'threshold_not_met'
    | 'category_inactive'
    | 'partner_unavailable'
    | 'limit_reached';
}
