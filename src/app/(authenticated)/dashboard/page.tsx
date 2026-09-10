import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { dbService } from '@/lib/db/service';
import { DashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

async function loadDashboardData(reportId?: string) {
  try {
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

    const stats = await dbService.getStoreStats(user.id);
    const storeConnection = await dbService.getStoreConnection(user.id);
    const latestReport = reportId
      ? (await dbService.getReportForUser(user.id, reportId)) ||
        (await dbService.getLatestReport(user.id))
      : await dbService.getLatestReport(user.id);

    return { user, stats, storeConnection, latestReport };
  } catch (error: unknown) {
    const details = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: 'UnknownError', message: String(error), stack: undefined };
    console.error('[dashboard] error', { name: details.name, message: details.message });
    console.error('[dashboard] stack', details.stack || details.message);
    throw error;
  }
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ reportId?: string }>;
}) {
  const { reportId } = await searchParams;
  const { user, stats, storeConnection, latestReport } = await loadDashboardData(reportId);

  return (
    <DashboardClient
      user={user}
      stats={stats}
      storeConnection={storeConnection}
      latestReport={latestReport}
    />
  );
}
