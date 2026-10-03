import { getCurrentUser } from '@/lib/auth/utils';
import { OTP_WINDOW_MS, limiterDigest } from '@/lib/auth/otp';
import { getD1Database } from '@/lib/db/d1';
import { getRuntimeString } from '@/lib/runtime/environment';
import { getUserEntitlements } from '@/lib/subscription/service';

export const BUSINESS_EXPORT_MAX_ROWS = 1_000;
export const BUSINESS_EXPORT_MAX_BYTES = 1_048_576;
export const BUSINESS_EXPORT_RATE_LIMIT = 5;

type ExportRow = {
  created_at: number | string | null;
  time_range_start: number | string | null;
  time_range_end: number | string | null;
  gross_sales_halala: number | string | null;
  orders_count: number | string | null;
  total_profit_halala: number | string | null;
  margin_pct_x100: number | string | null;
  missing_cost_products_count: number | string | null;
  missing_cost_sales_halala: number | string | null;
};

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
};

export type BusinessExportD1 = {
  prepare(sql: string): D1Statement;
};

type ExportEntitlements = {
  isActiveNow: boolean;
  limits: { dataExport: boolean };
};

type RateLimitResult = { allowed: boolean; retryAfter: number };

const REPORT_SUMMARY_QUERY = `SELECT
  created_at, time_range_start, time_range_end, gross_sales_halala,
  orders_count, total_profit_halala, margin_pct_x100,
  missing_cost_products_count, missing_cost_sales_halala
FROM report_snapshots
WHERE user_id = ?
ORDER BY time_range_end DESC
LIMIT ?`;

const CSV_HEADERS = [
  'report_created_at',
  'period_start',
  'period_end',
  'gross_sales_sar',
  'orders_count',
  'total_profit_sar',
  'margin_percent',
  'missing_cost_products_count',
  'missing_cost_sales_sar',
];

function json(value: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store', ...headers },
  });
}

function numeric(value: number | string | null): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function isoDate(value: number | string | null): string {
  const raw = numeric(value);
  if (!raw) return '';
  const milliseconds = Math.abs(raw) < 10_000_000_000 ? raw * 1_000 : raw;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function halalaToSar(value: number | string | null): string {
  const halala = Math.trunc(numeric(value));
  const sign = halala < 0 ? '-' : '';
  const absolute = Math.abs(halala);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function csvCell(value: string | number): string {
  const raw = String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function rowToCsv(row: ExportRow): string {
  return [
    isoDate(row.created_at),
    isoDate(row.time_range_start),
    isoDate(row.time_range_end),
    halalaToSar(row.gross_sales_halala),
    Math.trunc(numeric(row.orders_count)),
    halalaToSar(row.total_profit_halala),
    (numeric(row.margin_pct_x100) / 100).toFixed(2),
    Math.trunc(numeric(row.missing_cost_products_count)),
    halalaToSar(row.missing_cost_sales_halala),
  ].map(csvCell).join(',');
}

export function buildBusinessReportCsv(rows: ExportRow[]): string {
  const lines = [`\uFEFF${CSV_HEADERS.map(csvCell).join(',')}`];
  let bytes = new TextEncoder().encode(lines[0]).byteLength;
  for (const row of rows.slice(0, BUSINESS_EXPORT_MAX_ROWS)) {
    const line = rowToCsv(row);
    const lineBytes = new TextEncoder().encode(`\r\n${line}`).byteLength;
    if (bytes + lineBytes > BUSINESS_EXPORT_MAX_BYTES) break;
    lines.push(line);
    bytes += lineBytes;
  }
  return lines.join('\r\n');
}

async function consumeBusinessExportLimit(
  db: BusinessExportD1,
  userId: string,
  now = Date.now(),
): Promise<RateLimitResult> {
  const windowStart = Math.floor(now / OTP_WINDOW_MS) * OTP_WINDOW_MS;
  const hmacSecret = getRuntimeString('OTP_HMAC_SECRET');
  const keyHash = limiterDigest(`business-export:${userId}`, true, hmacSecret);
  const row = await db.prepare(
    `INSERT INTO otp_rate_limits (key_hash, window_start, expires_at, count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(key_hash, window_start) DO UPDATE SET count = count + 1
     WHERE count < ? RETURNING count`,
  ).bind(
    keyHash,
    windowStart,
    windowStart + OTP_WINDOW_MS,
    BUSINESS_EXPORT_RATE_LIMIT,
  ).first();
  return {
    allowed: Boolean(row),
    retryAfter: Math.max(1, Math.ceil((windowStart + OTP_WINDOW_MS - now) / 1_000)),
  };
}

export function createBusinessDataExportHandler(options: {
  getUser?: () => Promise<{ id: string } | null>;
  getEntitlements?: (userId: string) => Promise<ExportEntitlements>;
  getDb?: () => BusinessExportD1 | null;
  consumeLimit?: (db: BusinessExportD1, userId: string) => Promise<RateLimitResult>;
  now?: () => number;
} = {}) {
  return async function GET(request: Request): Promise<Response> {
    const user = await (options.getUser ?? getCurrentUser)();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const url = new URL(request.url);
    if (url.searchParams.size > 0) {
      return json({ error: 'Export selectors are not supported' }, 400);
    }

    try {
      const entitlements = await (options.getEntitlements ?? getUserEntitlements)(user.id);
      if (!entitlements.isActiveNow || !entitlements.limits.dataExport) {
        return json({ error: 'Business subscription required' }, 403);
      }

      const db = (options.getDb ?? (() => getD1Database() as BusinessExportD1 | null))();
      if (!db) return json({ error: 'Export unavailable' }, 503);

      const rateLimit = await (options.consumeLimit ?? consumeBusinessExportLimit)(db, user.id);
      if (!rateLimit.allowed) {
        return json(
          { error: 'Too many export requests' },
          429,
          { 'Retry-After': String(rateLimit.retryAfter) },
        );
      }

      const result = await db.prepare(REPORT_SUMMARY_QUERY)
        .bind(user.id, BUSINESS_EXPORT_MAX_ROWS)
        .all<ExportRow>();
      const csv = buildBusinessReportCsv(Array.isArray(result.results) ? result.results : []);
      const date = new Date((options.now ?? Date.now)()).toISOString().slice(0, 10);
      return new Response(csv, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename="isaudi-report-summaries-${date}.csv"`,
          'Content-Type': 'text/csv; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      console.error('[business-data-export] Request failed');
      return json({ error: 'Export unavailable' }, 503);
    }
  };
}
