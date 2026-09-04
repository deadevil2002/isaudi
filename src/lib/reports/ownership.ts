export interface ReportRecord {
  id: string;
}

export interface OwnedReportLookup<T extends ReportRecord> {
  getLatestReport(userId: string): Promise<T | null | undefined>;
  getReportForUser(userId: string, reportId: string): Promise<T | null | undefined>;
}

export async function resolveReportForUser<T extends ReportRecord>(
  reports: OwnedReportLookup<T>,
  userId: string,
  requestedReportId: string | null
): Promise<T | null> {
  if (requestedReportId) {
    return (await reports.getReportForUser(userId, requestedReportId)) ?? null;
  }

  return (await reports.getLatestReport(userId)) ?? null;
}