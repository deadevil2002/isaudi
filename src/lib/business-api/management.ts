import { getCurrentUser } from '@/lib/auth/utils';
import { getD1Database } from '@/lib/db/d1';
import { getUserEntitlements } from '@/lib/subscription/service';
import type { BusinessApiD1 } from './db';
import {
  createBusinessApiKey,
  listBusinessApiKeys,
  revokeBusinessApiKey,
  rotateBusinessApiKey,
} from './key-service';

type ManagementUser = { id: string };
type ManagementAction = 'list' | 'create' | 'revoke' | 'rotate';

const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: PRIVATE });
}

export function createBusinessApiManagementHandler(options: {
  action: ManagementAction;
  getUser?: () => Promise<ManagementUser | null>;
  getEntitlements?: typeof getUserEntitlements;
  getDb?: () => BusinessApiD1 | null;
}) {
  return async (request: Request, context?: { params?: Promise<Record<string, string>> }) => {
    const user = await (options.getUser ?? getCurrentUser)();
    if (!user) return response({ error: 'Unauthorized' }, 401);
    const entitlements = await (options.getEntitlements ?? getUserEntitlements)(user.id);
    if (!entitlements.isActiveNow || !entitlements.limits.apiAccess) {
      return response({ error: 'Business subscription required' }, 403);
    }
    const db = (options.getDb ?? (() => getD1Database() as BusinessApiD1 | null))();
    if (!db) return response({ error: 'Service unavailable' }, 503);
    try {
      if (options.action === 'list') {
        return response({ keys: await listBusinessApiKeys(db, user.id) });
      }
      if (request.headers.get('origin') !== new URL(request.url).origin) {
        return response({ error: 'Invalid origin' }, 403);
      }
      if (options.action === 'create') {
        const contentLength = Number(request.headers.get('content-length') || 0);
        if (contentLength > 4096) return response({ error: 'Invalid request' }, 400);
        let body: { name?: unknown; scopes?: unknown };
        try {
          body = await request.json() as { name?: unknown; scopes?: unknown };
        } catch {
          return response({ error: 'Invalid request' }, 400);
        }
        const created = await createBusinessApiKey(db, { userId: user.id, name: body.name, scopes: body.scopes });
        return response({ key: created.key, secret: created.secret }, 201);
      }
      const keyId = (await context?.params)?.id?.trim();
      if (!keyId || keyId.length > 128 || !/^[0-9a-f-]+$/i.test(keyId)) return response({ error: 'Invalid key ID' }, 400);
      if (options.action === 'revoke') {
        return await revokeBusinessApiKey(db, user.id, keyId)
          ? response({ ok: true })
          : response({ error: 'Key not found' }, 404);
      }
      const rotated = await rotateBusinessApiKey(db, { userId: user.id, keyId });
      return rotated ? response({ key: rotated.key, secret: rotated.secret }) : response({ error: 'Key not found' }, 404);
    } catch (error) {
      if (error instanceof Error && ['invalid_name', 'invalid_scopes'].includes(error.message)) {
        return response({ error: 'Invalid key name or scopes' }, 400);
      }
      if (error instanceof Error && error.message === 'active_key_limit') {
        return response({ error: 'Active key limit reached' }, 409);
      }
      return response({ error: 'Service unavailable' }, 503);
    }
  };
}
