import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const student = await db.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return NextResponse.json({ success: true, data: { attended: 0, absent: 0, total: 0, rate: 0 } });
    const total = await db.attendanceSession.count();
    const attended = await db.attendance.count({ where: { studentId: student.id } });
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
    return NextResponse.json({ success: true, data: { attended, absent: total - attended, total, rate } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
