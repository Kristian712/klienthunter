import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken, hashPassword, comparePassword } from '@/lib/auth';
import { prisma } from '@/lib/db';

const UpdateSchema = z.object({
  name:        z.string().min(1).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, name: true, plan: true,
        isAdmin: true, isVip: true, createdAt: true,
        _count: { select: { searches: true } },
      },
    });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const searches = await prisma.search.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { _count: { select: { results: true } } },
    });

    const totalResults = await prisma.businessResult.count({
      where: { search: { userId: payload.userId } },
    });

    return NextResponse.json({ user, searches, totalResults });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    const body = await req.json();
    const { name, currentPassword, newPassword } = UpdateSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updateData: Record<string, string> = {};
    if (name) updateData.name = name;

    if (newPassword) {
      if (!currentPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 });
      const valid = await comparePassword(currentPassword, user.password);
      if (!valid) return NextResponse.json({ error: 'Wrong current password' }, { status: 400 });
      updateData.password = await hashPassword(newPassword);
    }

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: updateData,
      select: { id: true, email: true, name: true, plan: true, isAdmin: true, isVip: true },
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 422 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
