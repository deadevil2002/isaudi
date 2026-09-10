import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { createSallaLinkCode } from '@/lib/salla/repository';
import { generateSallaLinkCode } from '@/lib/salla/link-code';

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: PRIVATE_NO_STORE }
    );
  }
  if (user.email_verified !== 1) {
    return NextResponse.json(
      { error: 'Verified email required' },
      { status: 403, headers: PRIVATE_NO_STORE }
    );
  }

  try {
    const linkCode = generateSallaLinkCode();
    await createSallaLinkCode({
      id: linkCode.id,
      userId: String(user.id),
      codeHash: linkCode.codeHash,
      expiresAt: linkCode.expiresAt,
      createdAt: linkCode.createdAt,
    });
    return NextResponse.json(
      { code: linkCode.code, expiresAt: linkCode.expiresAt },
      { headers: PRIVATE_NO_STORE }
    );
  } catch {
    return NextResponse.json(
      { error: 'Unable to generate linking code' },
      { status: 500, headers: PRIVATE_NO_STORE }
    );
  }
}