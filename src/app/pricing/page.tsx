import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Pricing } from "@/components/sections/pricing";
import { createPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata = createPageMetadata({
  title: "الأسعار وخطط الاشتراك | isaudi.ai",
  description:
    "تعرّف على خطط isaudi.ai لتحليل بيانات المتاجر الإلكترونية واختر الخطة المناسبة لحجم متجرك واحتياجاته.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#06090c] text-[#f0f4f8] selection:bg-[#0fc9a7]/20 selection:text-[#0fc9a7]">
      <Header />
      <div className="pt-24">
        <Pricing user={null} subscription={null} compact />
      </div>
      <Footer />
    </main>
  );
}

