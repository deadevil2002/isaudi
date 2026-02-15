import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { dbService } from '@/lib/db/service';
import { BillingClient } from './billing-client';
import { Header } from '@/components/layout/header';

export default async function BillingPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;

  if (!sessionId) {
    redirect('/login');
  }

  const session = dbService.getSession(sessionId);
  if (!session) {
    redirect('/login');
  }

  const user = dbService.getUserById(session.userId);
  if (!user) {
    redirect('/login');
  }

  return (
    <>
      <Header userEmail={user.email} />
      <BillingClient user={user} />
    </>
  );
}
