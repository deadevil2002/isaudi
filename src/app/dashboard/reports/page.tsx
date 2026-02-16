import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { dbService } from '@/lib/db/service';
import { Header } from '@/components/layout/header';
import { ReportsClient } from './reports-client';

export default async function ReportsPage() {
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

  const isFree = user.plan === 'free';

  return (
    <>
      <Header userEmail={user.email} />
      <ReportsClient isFree={isFree} />
    </>
  );
}
