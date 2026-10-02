import { getCurrentUser } from '@/lib/auth/utils';
import { registerReferralClick, ReferralAccessError } from '@/lib/referrals/service';

export async function GET(
  request: Request,
  context: { params: Promise<{ referralId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    const login = new URL('/login', request.url);
    return Response.redirect(login, 302);
  }
  const { referralId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(referralId)) {
    return Response.json({ error: 'referral_not_found' }, { status: 404 });
  }
  try {
    const destination = await registerReferralClick({
      userId: user.id,
      referralId,
    });
    return Response.redirect(destination, 302);
  } catch (error) {
    const status = error instanceof ReferralAccessError ? error.status : 400;
    return Response.json(
      { error: error instanceof ReferralAccessError ? error.reason : 'referral_unavailable' },
      { status, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
