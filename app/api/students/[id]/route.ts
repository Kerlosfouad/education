export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const student = await db.student.findUnique({ where: { id: params.id } });
    if (!student) return NextResponse.json({ success: false }, { status: 404 });

    const userId = student.userId;

    // Delete all student-related data
    await db.examResult.deleteMany({ where: { studentId: student.id } }).catch(() => {});
    await db.attendance.deleteMany({ where: { studentId: student.id } }).catch(() => {});
    await db.assignmentSubmission.deleteMany({ where: { studentId: student.id } }).catch(() => {});
    await db.quizAttempt.deleteMany({ where: { studentId: student.id } }).catch(() => {});
    await db.$executeRaw`DELETE FROM student_subjects WHERE "studentId" = ${student.id}`.catch(() => {});
    await db.$executeRaw`DELETE FROM enrollment_requests WHERE "studentId" = ${student.id}`.catch(() => {});
    if (userId) {
      await db.notification.deleteMany({ where: { userId } }).catch(() => {});
      await db.loginHistory.deleteMany({ where: { userId } }).catch(() => {});
    }

    // Delete the student record
    await db.student.delete({ where: { id: student.id } }).catch(() => {});

    // Completely delete the user account so they can register again
    if (userId) {
      await db.user.delete({ where: { id: userId } }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Delete student error:', e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
