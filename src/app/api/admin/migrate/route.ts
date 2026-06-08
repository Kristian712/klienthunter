import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const results: string[] = [];

    // Add accessExpiresAt to User
    try {
      await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accessExpiresAt" TIMESTAMP(3)`;
      results.push('User.accessExpiresAt: OK');
    } catch (e) {
      results.push(`User.accessExpiresAt: ${e}`);
    }

    // Add accessDurationMinutes to InviteCode
    try {
      await prisma.$executeRaw`ALTER TABLE "InviteCode" ADD COLUMN IF NOT EXISTS "accessDurationMinutes" INTEGER`;
      results.push('InviteCode.accessDurationMinutes: OK');
    } catch (e) {
      results.push(`InviteCode.accessDurationMinutes: ${e}`);
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
