import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

export const SALLA_OAUTH_STATE_COOKIE = 'salla_oauth_state';
export const SALLA_OAUTH_STATE_TTL_SECONDS = 10 * 60;

interface OAuthStatePayload {
  state: string;
  sessionHash: string;
  expiresAt: number;
}

interface OAuthStateChallenge {
  state: string;
  nonceHash: string;
  cookieValue: string;
  expiresAt: number;
}

interface ConsumeOAuthStateInput {
  returnedState: string | null;
  sessionId: string | null;
  signingSecret: string;
  takeStoredState: () => string | null;
  consumeNonce: (
    nonceHash: string,
    sessionId: string,
    now: number
  ) => Promise<boolean>;
  now?: number;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function hashSession(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('hex');
}

export function createSallaOAuthState(
  sessionId: string,
  signingSecret: string,
  now = Date.now()
): OAuthStateChallenge {
  const payload: OAuthStatePayload = {
    state: randomBytes(32).toString('base64url'),
    sessionHash: hashSession(sessionId),
    expiresAt: now + SALLA_OAUTH_STATE_TTL_SECONDS * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url'
  );
  const signature = signPayload(encodedPayload, signingSecret);

  return {
    state: payload.state,
    nonceHash: createHash('sha256').update(payload.state).digest('hex'),
    cookieValue: `${encodedPayload}.${signature}`,
    expiresAt: payload.expiresAt,
  };
}

export async function consumeSallaOAuthState({
  returnedState,
  sessionId,
  signingSecret,
  takeStoredState,
  consumeNonce,
  now = Date.now(),
}: ConsumeOAuthStateInput): Promise<boolean> {
  const storedState = takeStoredState();
  if (!storedState || !returnedState || !sessionId || !signingSecret) {
    return false;
  }

  const parts = storedState.split('.');
  if (parts.length !== 2) return false;

  const [encodedPayload, suppliedSignature] = parts;
  const expectedSignature = signPayload(encodedPayload, signingSecret);
  if (!safeEqual(suppliedSignature, expectedSignature)) return false;

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as OAuthStatePayload;
  } catch {
    return false;
  }

  if (
    typeof payload.state !== 'string' ||
    typeof payload.sessionHash !== 'string' ||
    typeof payload.expiresAt !== 'number' ||
    payload.expiresAt <= now
  ) {
    return false;
  }

  if (
    !safeEqual(returnedState, payload.state) ||
    !safeEqual(hashSession(sessionId), payload.sessionHash)
  ) {
    return false;
  }

  const nonceHash = createHash('sha256').update(payload.state).digest('hex');
  return consumeNonce(nonceHash, sessionId, now);
}