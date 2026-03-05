import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { dbService } from '@/lib/db/service';
import { Header } from '@/components/layout/header';
import { SettingsClient } from './settings-client';
import { getUserEntitlements } from '@/lib/subscription/service';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
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

  const subscription = await getUserEntitlements(user.id);

  return (
    <>
      <Header userEmail={user.email} />
      <SettingsClient
        userEmail={user.email}
        emailVerified={Boolean((user as any).email_verified)}
        plan={user.plan}
        planExpiresAt={user.planExpiresAt || null}
        subscription={subscription}
      />
    </>
  );
}
