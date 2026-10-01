import { getDb } from '@/lib/db/client';

const REPORT_VIEW_PROJECTION = `id, json_object(
  'aiNarrative', json_extract(reportJson, '$.aiNarrative'),
  'summary', json_extract(reportJson, '$.summary'),
  'conversion_insight', json_extract(reportJson, '$.conversion_insight'),
  'pricing_suggestions', json_extract(reportJson, '$.pricing_suggestions'),
  'growth_opportunities', json_extract(reportJson, '$.growth_opportunities'),
  'metrics', json_extract(reportJson, '$.metrics'),
  'top_products', json_extract(reportJson, '$.top_products'),
  'weak_products', json_extract(reportJson, '$.weak_products'),
  'profitability', json_extract(reportJson, '$.profitability'),
  'snapshot', json_extract(reportJson, '$.snapshot')
) AS reportViewJson`;

export type DashboardReportRow = {
  id: string;
  reportViewJson: string;
};

export type DashboardReportRef = {
  id: string;
};

export async function hasStoreConnection(userId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.prepare(
    "SELECT 1 AS connected FROM store_connections WHERE userId = ? AND status = 'connected' LIMIT 1"
  ).get(userId) as { connected: number } | undefined;
  return row?.connected === 1;
}

export async function getDashboardReportForUser(
  userId: string,
  reportId: string
): Promise<DashboardReportRow | null> {
  const db = await getDb();
  return await db.prepare(`
    SELECT ${REPORT_VIEW_PROJECTION} FROM reports WHERE id = ? AND userId = ?
  `).get(reportId, userId) as DashboardReportRow | null;
}

export async function getLatestDashboardReport(
  userId: string
): Promise<DashboardReportRow | null> {
  const db = await getDb();
  return await db.prepare(`
    SELECT ${REPORT_VIEW_PROJECTION} FROM reports
    WHERE userId = ? ORDER BY createdAt DESC LIMIT 1
  `).get(userId) as DashboardReportRow | null;
}

export async function getDashboardReportRefForUser(
  userId: string,
  reportId: string
): Promise<DashboardReportRef | null> {
  const db = await getDb();
  return await db.prepare(`
    SELECT id FROM reports WHERE id = ? AND userId = ? LIMIT 1
  `).get(reportId, userId) as DashboardReportRef | null;
}

export async function getLatestDashboardReportRef(
  userId: string
): Promise<DashboardReportRef | null> {
  const db = await getDb();
  return await db.prepare(`
    SELECT id FROM reports
    WHERE userId = ? ORDER BY createdAt DESC LIMIT 1
  `).get(userId) as DashboardReportRef | null;
}
