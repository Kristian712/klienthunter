// TEST MODE: always returns null (no DB)
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ user: null });
}
