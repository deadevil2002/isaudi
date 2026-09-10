import { cookies } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { dbService } from '@/lib/db/service';
import { AuthenticatedShell } from '@/components/layout/authenticated-shell';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <AuthenticatedShell userEmail={user.email}>
      {children}
    </AuthenticatedShell>
  );
}
