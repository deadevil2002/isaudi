import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';

export async function GET(req: NextRequest) {
  const debugEmailVerify =
    process.env.NODE_ENV !== 'production' ||
    process.env.DEBUG_EMAIL_VERIFY === '1';

  try {
    const { searchParams } = new URL(req.url);
    const rawToken = searchParams.get('token');
    const token =
      rawToken && rawToken.length > 0
        ? rawToken.trim().replace(/ /g, '+')
        : null;

    if (!token) {
      if (debugEmailVerify) {
        console.log('[email-verify] api.verify-email missing token', {
          hasTokenParam: rawToken != null && rawToken.length > 0,
        });
      }
      return NextResponse.json({ success: false, error: 'invalid' }, { status: 400 });
    }

    const result = await dbService.verifyEmailByToken(token);

    if (!result.ok) {
      const reason = result.reason === 'expired' ? 'expired' : 'invalid';

      if (debugEmailVerify) {
        const clean = token.trim();
        const length = clean.length;
        const head = length <= 4 ? clean : clean.slice(0, 4);
        const tail = length <= 8 ? clean : clean.slice(-4);

        console.log('[email-verify] api.verify-email failure', {
          reason,
          token: {
            length,
            head,
            tail,
          },
        });
      }

      const status = 400;
      return NextResponse.json({ success: false, error: reason }, { status });
    }

    if (debugEmailVerify) {
      const clean = token.trim();
      const length = clean.length;
      const head = length <= 4 ? clean : clean.slice(0, 4);
      const tail = length <= 8 ? clean : clean.slice(-4);

      console.log('[email-verify] api.verify-email success', {
        token: {
          length,
          head,
          tail,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}
