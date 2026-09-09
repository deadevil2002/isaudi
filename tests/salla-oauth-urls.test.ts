import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSallaAuthorizationUrl,
  buildSallaTokenBody,
  resolveSallaRedirectUri,
  SALLA_PRODUCTION_REDIRECT_URI,
} from '../src/lib/salla/oauth-urls';

test('production Salla authorization always uses the canonical callback URI', () => {
  const redirectUri = resolveSallaRedirectUri(
    'https://untrusted.example/callback',
    true
  );
  const url = buildSallaAuthorizationUrl({
    clientId: 'configured-client-id',
    state: 'signed-state',
    scopes: 'products.read orders.read offline_access',
    redirectUri,
  });

  assert.equal(redirectUri, SALLA_PRODUCTION_REDIRECT_URI);
  assert.equal(
    url.searchParams.get('redirect_uri'),
    SALLA_PRODUCTION_REDIRECT_URI
  );
  assert.equal(url.searchParams.get('state'), 'signed-state');
});

test('Salla token exchange uses the same canonical production callback URI', () => {
  const redirectUri = resolveSallaRedirectUri(undefined, true);
  const body = buildSallaTokenBody({
    clientId: 'configured-client-id',
    clientSecret: 'configured-secret',
    code: 'authorization-code',
    redirectUri,
  });

  assert.equal(
    body.get('redirect_uri'),
    SALLA_PRODUCTION_REDIRECT_URI
  );
  assert.equal(body.get('grant_type'), 'authorization_code');
});

test('development may use an explicitly configured callback URI', () => {
  assert.equal(
    resolveSallaRedirectUri('http://localhost:3000/callback', false),
    'http://localhost:3000/callback'
  );
});