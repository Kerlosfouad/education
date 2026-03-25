import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      include: { user: { select: { name: true, email: true, image: true } }, department: true },
    });
    if (!student) return NextResponse.json({ success: false }, { status: 404 });
    return NextResponse.json({ success: true, data: student });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
