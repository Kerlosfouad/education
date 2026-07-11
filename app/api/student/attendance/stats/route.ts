export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getStudentSubjectAccess } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await db.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const now = new Date();

    const { semester, coreSubjectIds } = await getStudentSubjectAccess(student);

    // Count all sessions (closed + open) that match student's department, academicYear, and semester
    const relevantSessions = await db.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT s.id
      FROM attendance_sessions s
      LEFT JOIN student_subjects ss
        ON ss."studentId" = ${student.id}
        AND ss."subjectId" = s."subjectId"
      WHERE (
        s."subjectId" = ANY(${coreSubjectIds}::text[])
        OR (ss.id IS NOT NULL AND s."openTime" >= ss."enrolledAt")
        OR (
          (s."departmentId" IS NULL OR s."departmentId" = ${student.departmentId})
          AND (s."academicYear" IS NULL OR s."academicYear" = ${student.academicYear})
          AND (s."semester" IS NULL OR s."semester" = ${semester})
        )
      )
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
