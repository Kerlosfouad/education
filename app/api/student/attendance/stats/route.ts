export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent, getStudentSubjectAccess } from '@/lib/db';
import { cache } from '@/lib/cache';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await getOrCreateStudent(session.user.id);
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const stats = await cache.remember(
      `student:att-stats:${student.id}`,
      25, // 25 seconds cache
      async () => {
        const { semester, coreSubjectIds } = await getStudentSubjectAccess(student);

        // Count all sessions (closed + open) that match student's enrolled subjects or general department/year/semester
        const relevantSessions = await db.$queryRaw<{ id: string }[]>`
          SELECT DISTINCT s.id
          FROM attendance_sessions s
          WHERE (
            (s."subjectId" IS NOT NULL AND s."subjectId" = ANY(${coreSubjectIds}::text[]))
            OR (
              s."subjectId" IS NULL
              AND (s."departmentId" IS NULL OR s."departmentId" = ${student.departmentId})
              AND (s."academicYear" IS NULL OR s."academicYear" = ${student.academicYear})
              AND (s."semester" IS NULL OR s."semester" = ${semester})
            )
          )
        `;
        const relevantSessionIds = relevantSessions.map(s => s.id);

        const studentRecords = await db.attendance.findMany({
          where: { studentId: student.id },
          select: { sessionId: true, verificationMethod: true },
        });
        const studentSessionIds = studentRecords.map(a => a.sessionId);
        const allSessionIds = Array.from(new Set([...relevantSessionIds, ...studentSessionIds]));
        const total = allSessionIds.length;
        const attended = studentRecords.filter(a => a.verificationMethod !== 'ABSENT').length;
        const absent = total > attended ? total - attended : 0;
        const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

        return { total, attended, absent, rate };
      },
      [`student:${student.id}`, `student:att:${student.id}`]
    );

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
