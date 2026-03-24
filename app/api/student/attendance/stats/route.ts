import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await db.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const now = new Date();
    const total = await db.attendanceSession.count({ where: { closeTime: { lt: now } } });
    const attended = await db.attendance.count({
      where: { studentId: student.id, verificationMethod: { not: 'ABSENT' } },
    });
    const absent = await db.attendance.count({
      where: { studentId: student.id, verificationMethod: 'ABSENT' },
    });
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

    return NextResponse.json({ success: true, data: { total, attended, absent, rate } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
