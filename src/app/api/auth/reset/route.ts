import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const Body = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(8).max(200),
});

/**
 * Nastavení nového hesla z odkazu v e-mailu. Token je na jedno použití a hodinu platný;
 * po použití se zneplatní i všechny ostatní tokeny účtu (staré odkazy v poště nesmí fungovat).
 */
export async function POST(req: NextRequest) {
  try {
    const { token, password } = Body.parse(await req.json());
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const reset = await prisma.passwordReset.findUnique({ where: { tokenHash } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { password: await hashPassword(password) } }),
      prisma.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid input', code: 'INVALID' }, { status: 422 });
    console.error('/api/auth/reset:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
