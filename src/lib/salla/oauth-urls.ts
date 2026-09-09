export const SALLA_PRODUCTION_REDIRECT_URI =
  'https://isaudi.ai/api/connect/salla/callback';

export function resolveSallaRedirectUri(
  configuredUri: string | undefined,
  isProduction: boolean
): string {
  if (isProduction) return SALLA_PRODUCTION_REDIRECT_URI;
  return configuredUri?.trim() || SALLA_PRODUCTION_REDIRECT_URI;
}

export function buildSallaAuthorizationUrl(input: {
  clientId: string;
  state: string;
  redirectUri: string;
  scopes: string;
}): URL {
  const url = new URL('https://accounts.salla.sa/oauth2/auth');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', input.scopes);
  url.searchParams.set('state', input.state);
  return url;
}

export function buildSallaTokenBody(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): URLSearchParams {
  return new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
  });
}