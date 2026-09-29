import { HowItWorksPageContent } from "@/components/sections/how-it-works-page";
import { createPageMetadata } from "@/lib/seo/metadata";
import { getPublicHowItWorksVideo } from "@/lib/video/public";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "كيف يعمل iSaudi | How iSaudi Works",
  description:
    "تعرّف على طريقة ربط متجرك وتحليل المبيعات والربحية في iSaudi. Learn how iSaudi turns store data into clear reports and practical recommendations.",
  path: "/how-it-works",
});

export default async function HowItWorksPage() {
  return <HowItWorksPageContent video={await getPublicHowItWorksVideo()} />;
}
