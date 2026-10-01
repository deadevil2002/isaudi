import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { getDashboardReportForUser } from '@/lib/dashboard/data';
import { parseReportViewData } from '@/lib/dashboard/report-view-data';

export const dynamic = 'force-dynamic';

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: PRIVATE_NO_STORE },
    );
  }

  const reportId = request.nextUrl.searchParams.get('reportId')?.trim();
  if (!reportId || reportId.length > 128) {
    return NextResponse.json(
      { error: 'Invalid report ID' },
      { status: 400, headers: PRIVATE_NO_STORE },
    );
  }

  const report = await getDashboardReportForUser(user.id, reportId);
  if (!report) {
    return NextResponse.json(
      { error: 'Report not found' },
      { status: 404, headers: PRIVATE_NO_STORE },
    );
  }

  return NextResponse.json(
    {
      report: {
        id: report.id,
        data: parseReportViewData(report.reportViewJson),
      },
    },
    { headers: PRIVATE_NO_STORE },
  );
}
