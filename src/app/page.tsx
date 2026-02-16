import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { SampleReport } from "@/components/sections/sample-report";
import { Pricing } from "@/components/sections/pricing";
import { Trust } from "@/components/sections/trust";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dbService } from "@/lib/db/service";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value || null;

  if (sessionId) {
    const session = await dbService.getSession(sessionId);
    if (session) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="min-h-screen bg-white selection:bg-isaudi-green/20 selection:text-isaudi-green-dark">
      <Header />
      <Hero />
      <HowItWorks />
      <SampleReport />
      <Pricing />
      <Trust />
      <Footer />
    </main>
  );
}
