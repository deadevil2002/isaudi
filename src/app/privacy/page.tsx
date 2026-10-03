import { LegalPolicyPage } from "@/components/legal/legal-policy-page";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "سياسة الخصوصية | Privacy Notice | isaudi.ai",
  description: "سياسة خصوصية iSaudi وبيان معالجة البيانات والتحليلات المجمعة — iSaudi privacy and aggregated analytics notice.",
  path: "/privacy",
});

export default function Page() {
  return <LegalPolicyPage kind="privacy" />;
}
