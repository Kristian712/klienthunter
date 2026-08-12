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

    // Add source to BusinessResult
    try {
      await prisma.$executeRaw`ALTER TABLE "BusinessResult" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'google'`;
      results.push('BusinessResult.source: OK');
    } catch (e) {
      results.push(`BusinessResult.source: ${e}`);
    }

    // Add websiteStatus / websiteEvidence to BusinessResult
    try {
      await prisma.$executeRaw`ALTER TABLE "BusinessResult" ADD COLUMN IF NOT EXISTS "websiteStatus" TEXT`;
      results.push('BusinessResult.websiteStatus: OK');
    } catch (e) {
      results.push(`BusinessResult.websiteStatus: ${e}`);
    }

    try {
      await prisma.$executeRaw`ALTER TABLE "BusinessResult" ADD COLUMN IF NOT EXISTS "websiteEvidence" TEXT NOT NULL DEFAULT ''`;
      results.push('BusinessResult.websiteEvidence: OK');
    } catch (e) {
      results.push(`BusinessResult.websiteEvidence: ${e}`);
    }

    // Vlna 2: registry fields. All nullable — NULL means "we never asked", which is a
    // different thing from "the answer was no", and the classifier relies on that.
    try {
      await prisma.$executeRaw`ALTER TABLE "BusinessResult" ADD COLUMN IF NOT EXISTS "ico" TEXT`;
      results.push('BusinessResult.ico: OK');
    } catch (e) {
      results.push(`BusinessResult.ico: ${e}`);
    }

    try {
      await prisma.$executeRaw`ALTER TABLE "BusinessResult" ADD COLUMN IF NOT EXISTS "vatPayer" BOOLEAN`;
      results.push('BusinessResult.vatPayer: OK');
    } catch (e) {
      results.push(`BusinessResult.vatPayer: ${e}`);
    }

    try {
      await prisma.$executeRaw`ALTER TABLE "BusinessResult" ADD COLUMN IF NOT EXISTS "vatUnreliable" BOOLEAN`;
      results.push('BusinessResult.vatUnreliable: OK');
    } catch (e) {
      results.push(`BusinessResult.vatUnreliable: ${e}`);
    }

    // Vlna 3: the three fields the new filters and the lead score are built on. Written as a
    // list rather than three more copy-pasted blocks — the SQL is a constant either way, so
    // $executeRawUnsafe takes no user input here.
    const wave3: Array<[string, string]> = [
      ['foundedAt', 'TIMESTAMP(3)'],
      ['websiteMs', 'INTEGER'],
      ['leadScore', 'INTEGER NOT NULL DEFAULT 0'],
    ];
    for (const [column, type] of wave3) {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "BusinessResult" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
        );
        results.push(`BusinessResult.${column}: OK`);
      } catch (e) {
        results.push(`BusinessResult.${column}: ${e}`);
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
