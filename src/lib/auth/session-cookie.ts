const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export function sessionCookieOptions(expiresAt: number, production: boolean) {
  return {
    httpOnly: true as const,
    secure: production,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: THIRTY_DAYS_SECONDS,
    expires: new Date(expiresAt),
  };
}

export function expiredSessionCookieOptions(production: boolean) {
  return {
    httpOnly: true as const,
    secure: production,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
}