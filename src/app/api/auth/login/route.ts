import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = LoginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Zablokovaný účet (admin mu nastavil `accessExpiresAt` do minulosti) i propadlá pozvánka.
    // Bez téhle kontroly stačilo se znovu přihlásit a blokace byla pryč — nový token o ní nevěděl.
    if (user.accessExpiresAt && user.accessExpiresAt < new Date()) {
      return NextResponse.json({ error: 'Access revoked', code: 'ACCESS_REVOKED' }, { status: 403 });
    }

    const token = signToken({
      // Časově omezený přístup si token nese s sebou, jinak by pozvánka na hodinu platila týden.
      accessExpiresAt: user.accessExpiresAt?.toISOString(),
      userId: user.id,
      email: user.email,
      plan: user.plan,
      isAdmin: user.isAdmin,
      isVip: user.isVip,
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
