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

    // Delete all student-related data
    await db.examResult.deleteMany({ where: { studentId: student.id } });
    await db.attendance.deleteMany({ where: { studentId: student.id } });
    await db.assignmentSubmission.deleteMany({ where: { studentId: student.id } });
    await db.quizAttempt.deleteMany({ where: { studentId: student.id } });
    await db.notification.deleteMany({ where: { userId: student.userId } });

    // Delete the student record
    await db.student.delete({ where: { id: student.id } });

    // Suspend the user account so they can't login or re-register with same email
    await db.user.update({
      where: { id: student.userId },
      data: { status: 'SUSPENDED', name: null, image: null },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Delete student error:', e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
