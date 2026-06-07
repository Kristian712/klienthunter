import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

const SaveSchema = z.object({
  cUser: z.string().min(1),
  xs:    z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);

    const body = await req.json();
    const { cUser, xs } = SaveSchema.parse(body);

    await prisma.user.update({
      where: { id: payload.userId },
      data: { facebookCUser: cUser.trim(), facebookXs: xs.trim() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 422 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);

    await prisma.user.update({
      where: { id: payload.userId },
      data: { facebookCUser: null, facebookXs: null },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { facebookCUser: true },
    });

    return NextResponse.json({ connected: Boolean(user?.facebookCUser) });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
