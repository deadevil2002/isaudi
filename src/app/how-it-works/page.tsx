import { HowItWorksPageContent } from "@/components/sections/how-it-works-page";
import { createPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata = createPageMetadata({
  title: "كيف يعمل iSaudi | How iSaudi Works",
  description:
    "تعرّف على طريقة ربط متجرك وتحليل المبيعات والربحية في iSaudi. Learn how iSaudi turns store data into clear reports and practical recommendations.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return <HowItWorksPageContent video={{ status: 'unavailable' }} loadPublicVideo />;
}
