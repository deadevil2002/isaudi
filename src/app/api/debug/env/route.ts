import { NextResponse } from 'next/server';

export async function GET() {
  const key = (process.env.OPENAI_API_KEY ?? '').trim();
  return NextResponse.json({
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV ?? null,
    openaiPresent: Boolean(key),
    openaiKeyPrefix: key ? key.slice(0, 7) : null
  });
}
