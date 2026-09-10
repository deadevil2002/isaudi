import { getCurrentUser } from '@/lib/auth/utils';
import { originGuard } from '@/lib/security/origin';
import {
  SallaVerificationPreconditionError,
  verifySallaConnection,
  type SallaVerificationResult,
} from './verification';

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' };
const INPUT_READ_TIMEOUT_MS = 1_000;

type VerifyUser = { id: string | number };

export interface SallaVerifyHandlerDependencies {
  getUser?: () => Promise<VerifyUser | null>;
  verify?: (userId: string) => Promise<SallaVerificationResult>;
  guardOrigin?: typeof originGuard;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: PRIVATE_NO_STORE,
  });
}

/**
 * The endpoint intentionally has no input contract.  A content-length header
 * lets us reject a declared body without reading it; otherwise inspect the
 * original stream so an empty POST stream is accepted while supplied bytes are
 * rejected.
 */
export async function hasUnexpectedInput(request: Request): Promise<boolean> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isFinite(length) || length !== 0) {
      return true;
    }
  }

  if (!request.body) return false;
  const reader = request.body.getReader();
  if (!reader) return false;

  let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | undefined;
  const deadline = Date.now() + INPUT_READ_TIMEOUT_MS;
  try {
    while (true) {
      if (Date.now() >= deadline) return true;
      pendingRead = reader.read();
      const remaining = Math.max(1, deadline - Date.now());
      const next = await new Promise<ReadableStreamReadResult<Uint8Array>>(
        (resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('input read timeout')), remaining);
          pendingRead!.then(resolve, reject).finally(() => clearTimeout(timer));
        }
      );
      if (next.done) return false;
      if (next.value.byteLength > 0) return true;
    }
  } catch {
    // An unreadable or slow body is supplied input and fails closed.
    return true;
  } finally {
    // The route never needs the request body after this check. Cancel the
    // original stream rather than a clone tee, which could wait on a branch
    // that is never consumed.
    try {
      void reader.cancel().catch(() => undefined);
    } catch {
      // The body is already closed or locked; it is still rejected safely.
    }
    pendingRead?.catch(() => undefined);
    try {
      reader.releaseLock();
    } catch {
      // A provider-controlled stream cannot turn input validation into 500.
    }
  }
}

export function createSallaVerifyHandler(
  dependencies: SallaVerifyHandlerDependencies = {}
) {
  const defaultGetUser = getCurrentUser as unknown as (
    () => Promise<VerifyUser | null>
  );
  const getUser = dependencies.getUser || defaultGetUser;
  const verify = dependencies.verify || verifySallaConnection;
  const guardOrigin = dependencies.guardOrigin || originGuard;

  return async function handleSallaVerify(request: Request): Promise<Response> {
    const originBlock = guardOrigin(request);
    if (originBlock) return json({ error: 'Invalid origin' }, 403);

    let user: VerifyUser | null;
    try {
      user = await getUser();
    } catch {
      return json({ error: 'Unable to verify Salla connection' }, 503);
    }
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const url = new URL(request.url);
    if ([...url.searchParams.keys()].length > 0) {
      return json({ error: 'No request input is expected' }, 400);
    }
    if (await hasUnexpectedInput(request)) {
      return json({ error: 'No request input is expected' }, 400);
    }

    try {
      return json(await verify(String(user.id)));
    } catch (error) {
      if (error instanceof SallaVerificationPreconditionError) {
        return json({ error: 'Salla connection unavailable' }, 409);
      }
      return json({ error: 'Unable to verify Salla connection' }, 503);
    }
  };
}