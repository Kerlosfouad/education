import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const students = await db.student.findMany({
      where: { user: { status: 'ACTIVE' }, studentCode: { not: '' } },
      include: {
        user: { select: { name: true } },
        attendances: { where: { verificationMethod: { not: 'ABSENT' } }, select: { id: true } },
        assignmentSubmissions: { select: { id: true } },
        quizAttempts: { where: { status: 'COMPLETED' }, select: { id: true, percentage: true } },
      }
    });

    // Fetch all sessions, quizzes, assignments in bulk
    const [allSessions, allQuizzes, allAssignments] = await Promise.all([
      db.attendanceSession.findMany({ select: { id: true, departmentId: true, academicYear: true } }),
      db.quiz.findMany({ where: { isPublished: true }, select: { id: true, departmentId: true, academicYear: true } }),
      db.assignment.findMany({ where: { isActive: true }, select: { id: true, departmentId: true, academicYear: true } }),
    ]);

    const data = students.map(student => {
      const totalSessions = allSessions.filter(s =>
        !s.departmentId ||
        (s.departmentId === student.departmentId && (s.academicYear === student.academicYear || s.academicYear === null))
      ).length;

      const totalQuizzes = allQuizzes.filter(q =>
        !q.departmentId ||
        (q.departmentId === student.departmentId && q.academicYear === student.academicYear)
      ).length;

      const totalAssignments = allAssignments.filter(a =>
        !a.departmentId ||
        (a.departmentId === student.departmentId && a.academicYear === student.academicYear)
      ).length;

      const attendanceRate = totalSessions > 0
        ? Math.round((student.attendances.length / totalSessions) * 100) : 0;
      const quizRate = totalQuizzes > 0
        ? Math.round((student.quizAttempts.length / totalQuizzes) * 100) : 0;
      const assignmentRate = totalAssignments > 0
        ? Math.round((student.assignmentSubmissions.length / totalAssignments) * 100) : 0;
      const avgQuizScore = student.quizAttempts.length > 0
        ? Math.round(student.quizAttempts.reduce((a, q) => a + (q.percentage ?? 0), 0) / student.quizAttempts.length) : 0;

      return {
        id: student.id,
        name: student.user.name ?? '—',
        studentCode: student.studentCode,
        attendanceRate,
        quizRate,
        assignmentRate,
        avgQuizScore,
        attendanceCount: student.attendances.length,
        quizCount: student.quizAttempts.length,
        assignmentCount: student.assignmentSubmissions.length,
        totalSessions,
        totalQuizzes,
        totalAssignments,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
