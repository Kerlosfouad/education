import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const student = await db.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return NextResponse.json({ success: true, data: [] });
    const records = await db.attendance.findMany({
      where: { studentId: student.id },
      include: { session: { include: { subject: { select: { name: true } } } } },
      orderBy: { timestamp: 'desc' },
    });
    return NextResponse.json({ success: true, data: records });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const student = await db.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
    const { sessionId } = await req.json();
    const existing = await db.attendance.findFirst({ where: { studentId: student.id, sessionId } });
    if (existing) return NextResponse.json({ success: false, error: 'Already marked' }, { status: 400 });
    const attendance = await db.attendance.create({ data: { studentId: student.id, sessionId, verificationMethod: 'MANUAL' } });
    return NextResponse.json({ success: true, data: attendance });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
