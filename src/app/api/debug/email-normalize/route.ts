import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail } from '@/lib/auth/email';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const value = searchParams.get('value');

  const inputs = value
    ? [value]
    : [
        'naimisalem@gmail.com',
        'naimi.salem@gmail.com',
        'naimi.salem+test@gmail.com',
        'naimi.salem@googlemail.com',
        'USER+test@Other.com',
        '  Mixed.Case+tag@GMAIL.com  ',
      ];

  const samples = inputs.map((input) => ({
    input,
    normalized: normalizeEmail(input),
  }));

  return NextResponse.json({ samples });
}

