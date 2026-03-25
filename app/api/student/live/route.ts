import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const sessions = await db.zoomLecture.findMany({
      include: { subject: { select: { name: true } } },
      orderBy: { scheduledAt: 'desc' },
    });
    return NextResponse.json({ success: true, data: sessions });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
