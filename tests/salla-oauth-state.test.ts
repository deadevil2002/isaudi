import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeSallaOAuthState,
  createSallaOAuthState,
  SALLA_OAUTH_STATE_TTL_SECONDS,
} from '../src/lib/salla/oauth-state';

const sessionId = 'session-a';
const otherSessionId = 'session-b';
const secret = 'test-only-salla-client-secret';
const now = 1_800_000_000_000;

function oneTimeStore(value: string | null) {
  let stored = value;
  return () => {
    const result = stored;
    stored = null;
    return result;
  };
}

function oneTimeNonce(expectedNonceHash: string) {
  let available = true;
  return async (nonceHash: string, boundSessionId: string, checkedAt: number) => {
    if (
      !available ||
      nonceHash !== expectedNonceHash ||
      boundSessionId !== sessionId ||
      checkedAt > now
    ) {
      return false;
    }
    available = false;
    return true;
  };
}

test('valid OAuth state succeeds for the initiating session', async () => {
  const challenge = createSallaOAuthState(sessionId, secret, now);

  assert.equal(
    await consumeSallaOAuthState({
      returnedState: challenge.state,
      sessionId,
      signingSecret: secret,
      takeStoredState: oneTimeStore(challenge.cookieValue),
      consumeNonce: oneTimeNonce(challenge.nonceHash),
      now,
    }),
    true
  );
});

test('missing OAuth state fails', async () => {
  const challenge = createSallaOAuthState(sessionId, secret, now);

  assert.equal(
    await consumeSallaOAuthState({
      returnedState: null,
      sessionId,
      signingSecret: secret,
      takeStoredState: oneTimeStore(challenge.cookieValue),
      consumeNonce: oneTimeNonce(challenge.nonceHash),
      now,
    }),
    false
  );
});

test('incorrect OAuth state and a different session both fail', async () => {
  const challenge = createSallaOAuthState(sessionId, secret, now);

  assert.equal(
    await consumeSallaOAuthState({
      returnedState: 'incorrect-state',
      sessionId,
      signingSecret: secret,
      takeStoredState: oneTimeStore(challenge.cookieValue),
      consumeNonce: oneTimeNonce(challenge.nonceHash),
      now,
    }),
    false
  );
  assert.equal(
    await consumeSallaOAuthState({
      returnedState: challenge.state,
      sessionId: otherSessionId,
      signingSecret: secret,
      takeStoredState: oneTimeStore(challenge.cookieValue),
      consumeNonce: oneTimeNonce(challenge.nonceHash),
      now,
    }),
    false
  );
});

test('expired or tampered stored OAuth state fails', async () => {
  const challenge = createSallaOAuthState(sessionId, secret, now);
  const [payload, signature] = challenge.cookieValue.split('.');
  const tamperedCookie = `${payload}.${signature.replace(/^./, signature[0] === 'a' ? 'b' : 'a')}`;

  assert.equal(
    await consumeSallaOAuthState({
      returnedState: challenge.state,
      sessionId,
      signingSecret: secret,
      takeStoredState: oneTimeStore(challenge.cookieValue),
      consumeNonce: oneTimeNonce(challenge.nonceHash),
      now: now + SALLA_OAUTH_STATE_TTL_SECONDS * 1000 + 1,
    }),
    false
  );
  assert.equal(
    await consumeSallaOAuthState({
      returnedState: challenge.state,
      sessionId,
      signingSecret: secret,
      takeStoredState: oneTimeStore(tamperedCookie),
      consumeNonce: oneTimeNonce(challenge.nonceHash),
      now,
    }),
    false
  );
});

test('OAuth state storage is single-use across replayed requests', async () => {
  const challenge = createSallaOAuthState(sessionId, secret, now);
  const consumeNonce = oneTimeNonce(challenge.nonceHash);

  const firstAttempt = consumeSallaOAuthState({
    returnedState: challenge.state,
    sessionId,
    signingSecret: secret,
    takeStoredState: () => challenge.cookieValue,
    consumeNonce,
    now,
  });
  const replayedAttempt = consumeSallaOAuthState({
    returnedState: challenge.state,
    sessionId,
    signingSecret: secret,
    takeStoredState: () => challenge.cookieValue,
    consumeNonce,
    now,
  });

  const results = await Promise.all([firstAttempt, replayedAttempt]);
  assert.deepEqual(results.sort(), [false, true]);
});