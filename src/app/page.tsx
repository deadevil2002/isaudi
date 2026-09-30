import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { SampleReport } from "@/components/sections/sample-report";
import { Pricing } from "@/components/sections/pricing";
import { Trust } from "@/components/sections/trust";
import { createPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-static';
export const metadata = createPageMetadata({
  title: 'isaudi.ai | ذكاء اصطناعي لتحليل ونمو المتاجر الإلكترونية',
  description:
    'حلّل أداء متجرك الإلكتروني في السعودية واحصل على تقارير وتوصيات عملية تساعدك على فهم المبيعات واكتشاف فرص النمو.',
  path: '/',
});
export const revalidate = false;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#06090c] text-[#f0f4f8] selection:bg-[#0fc9a7]/20 selection:text-[#0fc9a7]">
      <Header />
      <Hero />
      <HowItWorks />
      <SampleReport />
      <Pricing user={null} subscription={null} />
      <Trust />
      <Footer />
    </main>
  );
}
