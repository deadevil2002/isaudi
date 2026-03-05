import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { dbService } from '@/lib/db/service';
import { BillingClient } from './billing-client';
import { Header } from '@/components/layout/header';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  noStore();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;

  if (!sessionId) {
    redirect('/login');
  }

  const session = await dbService.getSession(sessionId);
  if (!session) {
    redirect('/login');
  }

  const user = await dbService.getUserById(session.userId);
  if (!user) {
    redirect('/login');
  }

  const subscription = await dbService.getSubscriptionByUserId(user.id);

  return (
    <>
      <Header userEmail={user.email} />
      <BillingClient user={user} subscription={subscription} />
    </>
  );
}
