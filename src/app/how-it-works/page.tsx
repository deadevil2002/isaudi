import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HowItWorksPageContent } from "@/components/sections/how-it-works-page";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "كيف يعمل iSaudi | How iSaudi Works",
  description:
    "تعرّف على طريقة ربط متجرك وتحليل المبيعات والربحية في iSaudi. Learn how iSaudi turns store data into clear reports and practical recommendations.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white selection:bg-isaudi-green/20 selection:text-isaudi-green-dark">
      <Header />
      <div className="pt-20">
        <HowItWorksPageContent />
      </div>
      <Footer />
    </main>
  );
}
