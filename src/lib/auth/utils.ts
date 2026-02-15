import { dbService } from '@/lib/db/service';
import { cookies } from 'next/headers';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;

  if (!sessionId) return null;

  const session = dbService.getSession(sessionId);
  if (!session) return null;

  return dbService.getUserById(session.userId);
}

export async function requirePlan(allowedPlans: string[] = ['basic', 'pro', 'business']) {
  const user = await getCurrentUser();

  if (!user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  if (user.plan === 'free' && !allowedPlans.includes('free')) {
    return { authorized: false, error: 'Payment Required', status: 403 };
  }

  // Check expiration if not free
  if (user.plan !== 'free' && user.planExpiresAt && user.planExpiresAt < Date.now()) {
    // Optionally we could downgrade user here or just deny access
    return { authorized: false, error: 'Subscription Expired', status: 403 };
  }

  return { authorized: true, user };
}

export async function requirePremiumUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false as const, status: 401 as const, error: 'Unauthorized', user: null as null };
  }
  if (user.plan === 'free') {
    return { ok: false as const, status: 403 as const, error: 'Payment Required', user: null as null };
  }
  return { ok: true as const, status: 200 as const, error: null as null, user };
}
