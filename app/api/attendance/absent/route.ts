export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canStudentAccessScopedContent, db, getOrCreateStudent } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const student = await getOrCreateStudent(session.user.id);
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const attendanceSession = await db.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!attendanceSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const now = new Date();
    if (!attendanceSession.isOpen || now < attendanceSession.openTime || now > attendanceSession.closeTime) {
      return NextResponse.json({ error: 'Attendance session is not open' }, { status: 400 });
    }

    const sessionRaw = await db.$queryRaw<{ subjectId: string | null; departmentId: string | null; academicYear: number | null; semester: number | null }[]>`
      SELECT "subjectId", "departmentId", "academicYear", "semester" FROM attendance_sessions WHERE id = ${sessionId}
    `;
    const canAccessSession = sessionRaw[0]
      ? await canStudentAccessScopedContent(student, sessionRaw[0])
      : false;

    if (!canAccessSession) {
      return NextResponse.json({ error: 'This session is not available for your account' }, { status: 403 });
    }

    const existing = await db.attendance.findFirst({
      where: { studentId: student.id, sessionId },
    });

    if (existing) {
      if (existing.verificationMethod === 'ABSENT') {
        return NextResponse.json({ success: true, data: existing });
      }

      const attendance = await db.attendance.update({
        where: { id: existing.id },
        data: {
          verificationMethod: 'ABSENT',
          timestamp: now,
        },
      });

      return NextResponse.json({ success: true, data: attendance, updated: true });
    }

    const attendance = await db.attendance.create({
      data: {
        studentId: student.id,
        sessionId,
        verificationMethod: 'ABSENT',
      },
    });

    return NextResponse.json({ success: true, data: attendance });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
