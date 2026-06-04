import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('auth-token')?.value;
  if (!token) return NextResponse.json({ user: null, _d: 'no_token' });

  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    return NextResponse.json({ user: null, _d: 'jwt_fail', _e: String(e) });
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, plan: true, isAdmin: true, isVip: true },
    });
  } catch (e) {
    return NextResponse.json({ user: null, _d: 'db_fail', _e: String(e) });
  }

  return NextResponse.json({ user, _d: 'ok' });
}
