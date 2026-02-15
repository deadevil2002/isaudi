import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Pricing } from "@/components/sections/pricing";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white selection:bg-isaudi-green/20 selection:text-isaudi-green-dark">
      <Header />
      <div className="pt-24">
        <Pricing />
      </div>
      <Footer />
    </main>
  );
}

