import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 confusion
  const seg = () => Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}`;
}

// GET  – list all invite codes
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const codes = await prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        creator:    { select: { name: true, email: true } },
        usedByUser: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({ codes });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST – generate new invite code(s)
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const count                 = Math.min(Number(body.count) || 1, 50);
    const note                  = body.note?.trim() || null;
    const expiresAt             = body.expiresAt ? new Date(body.expiresAt) : null;
    const accessDurationMinutes = body.accessDurationMinutes ? Number(body.accessDurationMinutes) : null;

    const created = await Promise.all(
      Array.from({ length: count }, () =>
        prisma.inviteCode.create({
          data: { code: generateCode(), note, expiresAt, accessDurationMinutes, createdBy: payload.userId },
        })
      )
    );

    return NextResponse.json({ codes: created });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
