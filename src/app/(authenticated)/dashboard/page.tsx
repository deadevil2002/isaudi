import { redirect } from 'next/navigation';
import { dbService } from '@/lib/db/service';
import { getCurrentUser } from '@/lib/auth/utils';
import {
  getDashboardReportForUser,
  getLatestDashboardReport,
  hasStoreConnection,
} from '@/lib/dashboard/data';
import { parseReportViewData } from '@/lib/dashboard/report-view-data';
import { DashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

async function loadDashboardData(reportId?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      redirect('/login');
    }

    const report = async () => {
      if (!reportId) return getLatestDashboardReport(user.id);
      return (await getDashboardReportForUser(user.id, reportId)) ||
        getLatestDashboardReport(user.id);
    };
    const [stats, storeConnected, reportRow] = await Promise.all([
      dbService.getStoreStats(user.id),
      hasStoreConnection(user.id),
      report(),
    ]);
    const latestReport = reportRow ? {
      id: reportRow.id,
      data: parseReportViewData(reportRow.reportViewJson),
    } : null;
    const dashboardUser = {
      id: user.id,
      email: user.email,
      plan: user.plan,
      freeReportsUsed: user.freeReportsUsed,
    };

    return { user: dashboardUser, stats, storeConnected, latestReport };
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
  const { user, stats, storeConnected, latestReport } = await loadDashboardData(reportId);

  return (
    <DashboardClient
      user={user}
      stats={stats}
      storeConnected={storeConnected}
      latestReport={latestReport}
    />
  );
}
