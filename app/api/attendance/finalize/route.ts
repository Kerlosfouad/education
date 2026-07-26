export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

type SessionScope = {
  subjectId: string | null;
  departmentId: string | null;
  academicYear: number | null;
  semester: number | null;
};

// POST /api/attendance/finalize - Mark absent for all students who didn't attend a session
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const scopeRows = await db.$queryRaw<SessionScope[]>`
      SELECT "subjectId", "departmentId", "academicYear", "semester"
      FROM attendance_sessions
      WHERE id = ${sessionId}
    `;
    const scope = scopeRows[0];
    if (!scope) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    if (!scope.subjectId && !scope.departmentId && scope.academicYear === null && scope.semester === null) {
      return NextResponse.json({ error: 'Cannot finalize an unscoped attendance session' }, { status: 400 });
    }

    const allStudents = scope.subjectId
      ? await db.$queryRaw<{ id: string }[]>`
          SELECT DISTINCT st.id
          FROM students st
          JOIN users u ON u.id = st."userId"
          JOIN subjects subj ON subj.id = ${scope.subjectId}
          LEFT JOIN student_subjects ss
            ON ss."studentId" = st.id
            AND ss."subjectId" = ${scope.subjectId}
          WHERE u.status = 'ACTIVE'
            AND (
              (
                st."departmentId" = subj."departmentId"
                AND st."academicYear" = subj."academicYear"
                AND st.semester = subj.semester
              )
              OR ss.id IS NOT NULL
            )
        `
      : await db.$queryRaw<{ id: string }[]>`
          SELECT st.id
          FROM students st
          JOIN users u ON u.id = st."userId"
          WHERE u.status = 'ACTIVE'
            AND (${scope.departmentId}::text IS NULL OR st."departmentId" = ${scope.departmentId})
            AND (${scope.academicYear}::int IS NULL OR st."academicYear" = ${scope.academicYear})
            AND (${scope.semester}::int IS NULL OR st.semester = ${scope.semester})
        `;

    // Get students who already have a record for this session
    const existing = await db.attendance.findMany({
      where: { sessionId },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map((a) => a.studentId));

    // Students with no record at all → mark ABSENT
    const toMark = allStudents.filter((s) => !existingIds.has(s.id));

    if (toMark.length > 0) {
      await db.attendance.createMany({
        data: toMark.map((s) => ({
          studentId: s.id,
          sessionId,
          verificationMethod: 'ABSENT',
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true, marked: toMark.length });
  } catch (error) {
    console.error('finalize attendance error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
