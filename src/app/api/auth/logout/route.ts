import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    
    if (sessionId) {
      await dbService.deleteSession(sessionId);
      cookieStore.set('session_id', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: new Date(0),
      });
    }
    
    return NextResponse.json({ success: true, redirectTo: '/' });
    
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
