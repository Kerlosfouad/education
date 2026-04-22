import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// POST /api/attendance/finalize - Mark absent for all students who didn't attend a session
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    // Get the session to know which department/year it targets
    const attendanceSession = await db.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!attendanceSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const sessionAny = attendanceSession as any;

    // Only get students that belong to this session's department/year filter
    const studentFilter: any = {};
    if (sessionAny.departmentId) studentFilter.departmentId = sessionAny.departmentId;
    if (sessionAny.academicYear !== null && sessionAny.academicYear !== undefined) {
      studentFilter.academicYear = sessionAny.academicYear;
    }

    const allStudents = await db.student.findMany({
      where: Object.keys(studentFilter).length > 0 ? studentFilter : undefined,
      select: { id: true },
    });

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
