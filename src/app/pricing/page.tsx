import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Pricing } from "@/components/sections/pricing";
import { getCurrentUser } from "@/lib/auth/utils";
import { getUserEntitlements } from "@/lib/subscription/service";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "الأسعار وخطط الاشتراك | isaudi.ai",
  description:
    "تعرّف على خطط isaudi.ai لتحليل بيانات المتاجر الإلكترونية واختر الخطة المناسبة لحجم متجرك واحتياجاته.",
  path: "/pricing",
});

export default async function PricingPage() {
  const user = await getCurrentUser();
  const subscription = user ? await getUserEntitlements(user.id) : null;

  return (
    <main className="min-h-screen bg-white selection:bg-isaudi-green/20 selection:text-isaudi-green-dark">
      <Header userEmail={user?.email} />
      <div className="pt-24">
        <Pricing user={user} subscription={subscription} />
      </div>
      <Footer />
    </main>
  );
}

