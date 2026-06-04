import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

// DELETE – revoke / delete invite code
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const code = await prisma.inviteCode.findUnique({ where: { id: params.id } });
    if (!code) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (code.usedAt) return NextResponse.json({ error: 'Code already used' }, { status: 400 });

    await prisma.inviteCode.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
