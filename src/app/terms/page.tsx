import { LegalPolicyPage } from "@/components/legal/legal-policy-page";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "الشروط والأحكام | Terms of Service | isaudi.ai",
  description: "شروط استخدام iSaudi وخدمات تحليل المتاجر — iSaudi terms for store analytics services.",
  path: "/terms",
});

export default function Page() {
  return <LegalPolicyPage kind="terms" />;
}
