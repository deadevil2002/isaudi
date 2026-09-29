import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/utils';
import { AuthenticatedShell } from '@/components/layout/authenticated-shell';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  noStore();
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <AuthenticatedShell userEmail={user.email}>
      {children}
    </AuthenticatedShell>
  );
}
