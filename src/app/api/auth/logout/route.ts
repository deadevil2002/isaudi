import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { cookies } from 'next/headers';
import { expiredSessionCookieOptions } from '@/lib/auth/session-cookie';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    
    cookieStore.set(
      'session_id',
      '',
      expiredSessionCookieOptions(process.env.NODE_ENV === 'production')
    );
    if (sessionId) {
      await dbService.deleteSession(sessionId);
    }
    
    return NextResponse.json({ success: true, redirectTo: '/' });
    
  } catch {
    console.error('Logout failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
