import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Read and delete only. The app stopped sending mail in Vlna 2, so there is no longer any
 * reason to accept a sending credential — but users who saved one before must still be able
 * to get it out of our database.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId } = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { brevoApiKey: true, brevoSenderEmail: true } });
    return NextResponse.json({ configured: Boolean(user?.brevoApiKey), senderEmail: user?.brevoSenderEmail });
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId } = verifyToken(token);
    await prisma.user.update({ where: { id: userId }, data: { brevoApiKey: null, brevoSenderEmail: null } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
