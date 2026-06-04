import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = RegisterSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    // First registered user becomes admin
    const userCount = await prisma.user.count();
    const isAdmin = userCount === 0;

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, isAdmin },
    });

    const token = signToken({
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
