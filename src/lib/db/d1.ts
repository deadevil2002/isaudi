import { getRuntimeEnvironment } from '@/lib/runtime/environment';

export function getD1Database(): unknown {
  const db = getRuntimeEnvironment().DB as {
    prepare?: unknown;
    batch?: unknown;
  } | null | undefined;
  return db && typeof db.prepare === 'function' && typeof db.batch === 'function'
    ? db
    : null;
}
