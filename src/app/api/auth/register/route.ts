import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';
import { REGISTRATIONS_PER_IP, countHits, hashIp, recordHit } from '@/lib/rate-limit';

const RegisterSchema = z.object({
  email:      z.string().email(),
  password:   z.string().min(8),
  name:       z.string().min(1).optional(),
  // Nepovinný od chvíle, kdy je registrace otevřená. Kód dál funguje — dává přístup na dobu,
  // kterou u něj admin nastavil — ale bez něj vznikne obyčejný účet na plánu FREE.
  inviteCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, inviteCode } = RegisterSchema.parse(body);

    /**
     * Strop na počet účtů z jedné IP.
     *
     * E-mail se neověřuje, takže bez tohohle by si kdokoli mohl zakládat účty s vymyšlenými
     * adresami a mít pokaždé dalších pět hledání zdarma — a každé z nich stojí dotaz na Overpass
     * a stovky requestů na cizí weby. Pět účtů za den je nad rámec toho, co udělá domácnost nebo
     * kancelář za jednou NAT adresou.
     */
    const ipHash = hashIp(req);
    if (await countHits(ipHash, 'register') >= REGISTRATIONS_PER_IP) {
      return NextResponse.json(
        { error: 'Too many accounts created from this address', code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }

    // ── Kód pozvánky, když nějaký přišel ──
    const trimmedCode = inviteCode?.trim().toUpperCase();
    const code = trimmedCode
      ? await prisma.inviteCode.findUnique({ where: { code: trimmedCode } })
      : null;

    if (trimmedCode) {
      if (!code) {
        return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 });
      }
      if (code.usedAt) {
        return NextResponse.json({ error: 'Invite code already used' }, { status: 400 });
      }
      if (code.expiresAt && code.expiresAt < new Date()) {
        return NextResponse.json({ error: 'Invite code expired' }, { status: 400 });
      }
    }

    // ── Check duplicate email ──
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    // First registered user becomes admin regardless of invite code
    const userCount = await prisma.user.count();
    const isAdmin = userCount === 0;

    const hashedPassword = await hashPassword(password);

    // Calculate access expiry from invite code duration
    const accessExpiresAt = (!isAdmin && code?.accessDurationMinutes)
      ? new Date(Date.now() + code.accessDurationMinutes * 60 * 1000)
      : null;

    // ── Create user + mark code as used in a transaction ──
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email, password: hashedPassword, name, isAdmin, accessExpiresAt },
      });
      if (code) {
        await tx.inviteCode.update({
          where: { id: code.id },
          data: { usedBy: newUser.id, usedAt: new Date() },
        });
      }
      return newUser;
    });

    // Zapisuje se až po úspěchu, aby odmítnutá registrace (obsazený e-mail, špatný kód)
    // nespotřebovala pokus.
    await recordHit(ipHash, 'register');

    const token = signToken({
      userId:  user.id,
      email:   user.email,
      plan:    user.plan,
      isAdmin: user.isAdmin,
      isVip:   user.isVip,
      accessExpiresAt: accessExpiresAt?.toISOString(),
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan, isAdmin: user.isAdmin, isVip: user.isVip },
    });
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
