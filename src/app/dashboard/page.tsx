import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { dbService } from '@/lib/db/service';
import { DashboardClient } from './dashboard-client';
import { Header } from '@/components/layout/header';

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: { reportId?: string };
}) {
  const searchParamsSource = searchParams as any;
  const resolvedSearchParams =
    searchParamsSource && typeof searchParamsSource.then === 'function'
      ? await searchParamsSource
      : searchParamsSource || {};

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
  
  const stats = dbService.getStoreStats(user.id);
  const storeConnection = dbService.getStoreConnection(user.id);

  const requestedReportId = resolvedSearchParams?.reportId;
  let latestReport = null as any;
  if (requestedReportId) {
    const candidate = dbService.getReportById(requestedReportId);
    latestReport = candidate && candidate.userId === user.id ? candidate : dbService.getLatestReport(user.id);
  } else {
    latestReport = dbService.getLatestReport(user.id);
  }

  return (
    <>
      <Header userEmail={user.email} />
      <DashboardClient 
        user={user} 
        stats={stats} 
        storeConnection={storeConnection} 
        latestReport={latestReport}
      />
    </>
  );
}
