import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { SampleReport } from "@/components/sections/sample-report";
import { Pricing } from "@/components/sections/pricing";
import { Trust } from "@/components/sections/trust";
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { dbService } from '@/lib/db/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getCurrentUser } from "@/lib/auth/utils";
import { getUserEntitlements } from "@/lib/subscription/service";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;
  if (sessionId) {
    const session = await dbService.getSession(sessionId);
    if (session) {
      redirect('/dashboard');
    }
  }

  const user = await getCurrentUser();
  const subscription = user ? await getUserEntitlements(user.id) : null;

  return (
    <main className="min-h-screen bg-white selection:bg-isaudi-green/20 selection:text-isaudi-green-dark">
      <Header />
      <Hero />
      <HowItWorks />
      <SampleReport />
      <Pricing user={user} subscription={subscription} />
      <Trust />
      <Footer />
    </main>
  );
}
