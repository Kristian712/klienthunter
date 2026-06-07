import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

const SaveSchema = z.object({ apiKey: z.string().min(1), senderEmail: z.string().email() });

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId } = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { brevoApiKey: true, brevoSenderEmail: true } });
    return NextResponse.json({ configured: Boolean(user?.brevoApiKey), senderEmail: user?.brevoSenderEmail });
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId } = verifyToken(token);
    const { apiKey, senderEmail } = SaveSchema.parse(await req.json());
    await prisma.user.update({ where: { id: userId }, data: { brevoApiKey: apiKey.trim(), brevoSenderEmail: senderEmail.trim() } });
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
    const { userId } = verifyToken(token);
    await prisma.user.update({ where: { id: userId }, data: { brevoApiKey: null, brevoSenderEmail: null } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
