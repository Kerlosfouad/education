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

    // Get semester
    const semesterRows = await db.$queryRaw<{semester: number}[]>`SELECT semester FROM students WHERE id = ${student.id}`;
    const semester = semesterRows[0]?.semester ?? null;

    // Count only sessions that match student's department, academicYear, and semester
    const relevantSessions = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM attendance_sessions
      WHERE "closeTime" < ${now}
      AND ("departmentId" IS NULL OR "departmentId" = ${student.departmentId})
      AND ("academicYear" IS NULL OR "academicYear" = ${student.academicYear})
      AND ("semester" IS NULL OR "semester" = ${semester})
    `;
    const relevantSessionIds = relevantSessions.map(s => s.id);
    const total = relevantSessionIds.length;
    const attended = await db.attendance.count({
      where: { studentId: student.id, sessionId: { in: relevantSessionIds }, verificationMethod: { not: 'ABSENT' } },
    });
    const absent = await db.attendance.count({
      where: { studentId: student.id, sessionId: { in: relevantSessionIds }, verificationMethod: 'ABSENT' },
    });
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

    return NextResponse.json({ success: true, data: { total, attended, absent, rate } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
