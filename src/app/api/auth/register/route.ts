import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';

const RegisterSchema = z.object({
  email:      z.string().email(),
  password:   z.string().min(8),
  name:       z.string().min(1).optional(),
  inviteCode: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, inviteCode } = RegisterSchema.parse(body);

    // ── Validate invite code ──
    const code = await prisma.inviteCode.findUnique({
      where: { code: inviteCode.trim().toUpperCase() },
    });

    if (!code) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 });
    }
    if (code.usedAt) {
      return NextResponse.json({ error: 'Invite code already used' }, { status: 400 });
    }
    if (code.expiresAt && code.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invite code expired' }, { status: 400 });
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
    const accessExpiresAt = (!isAdmin && code.accessDurationMinutes)
      ? new Date(Date.now() + code.accessDurationMinutes * 60 * 1000)
      : null;

    // ── Create user + mark code as used in a transaction ──
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email, password: hashedPassword, name, isAdmin, accessExpiresAt },
      });
      await tx.inviteCode.update({
        where: { id: code.id },
        data: { usedBy: newUser.id, usedAt: new Date() },
      });
      return newUser;
    });

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
