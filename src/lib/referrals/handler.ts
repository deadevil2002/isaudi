import { getCurrentUser } from '@/lib/auth/utils';
import {
  REQUEST_BODY_LIMITS,
  RequestBodyTooLargeError,
  readJsonWithLimit,
  requestTooLargeResponse,
} from '@/lib/security/request-size';
import {
  getEligibleReferrals,
  markReferralShown,
  ReferralAccessError,
} from './service';

type User = { id: string };

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
async function strictBody(request: Request, field: string): Promise<string> {
  const body = await readJsonWithLimit(request, REQUEST_BODY_LIMITS.json);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid');
  const record = body as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => key !== field) ||
    typeof record[field] !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(record[field])
  ) throw new Error('invalid');
  return record[field];
}

function accessError(error: unknown): Response {
  return error instanceof ReferralAccessError
    ? json({ error: error.reason }, error.status)
    : json({ error: 'request_failed' }, 400);
}

export function createEligibleReferralHandler(options: {
  getUser?: () => Promise<User | null>;
  eligible?: typeof getEligibleReferrals;
} = {}) {
  return async function POST(request: Request): Promise<Response> {
    const user = await (options.getUser ?? getCurrentUser)();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    try {
      const analysisId = await strictBody(request, 'analysisId');
      return json(await (options.eligible ?? getEligibleReferrals)({
        userId: user.id, analysisId,
      }));
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return requestTooLargeResponse();
      return accessError(error);
    }
  };
}

export function createShownReferralHandler(options: {
  getUser?: () => Promise<User | null>;
  shown?: typeof markReferralShown;
} = {}) {
  return async function POST(request: Request): Promise<Response> {
    const user = await (options.getUser ?? getCurrentUser)();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    try {
      const referralId = await strictBody(request, 'referralId');
      await (options.shown ?? markReferralShown)({ userId: user.id, referralId });
      return json({ success: true });
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return requestTooLargeResponse();
      return accessError(error);
    }
  };
}
