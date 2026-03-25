import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ status: 'UNKNOWN' });
    const user = await db.user.findUnique({ where: { email: session.user.email }, select: { status: true } });
    return NextResponse.json({ status: user?.status || 'UNKNOWN' });
  } catch {
    return NextResponse.json({ status: 'UNKNOWN' });
  }
}
