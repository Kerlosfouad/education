import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const students = await db.student.findMany({
      where: {
        user: { status: 'ACTIVE' },
      },
      include: {
        user: { select: { name: true } },
        attendances: true,
        assignmentSubmissions: true,
        quizAttempts: {
          where: { status: 'COMPLETED' }
        },
      }
    });

    const totalSessions = await db.attendanceSession.count();
    const totalQuizzes = await db.quiz.count({ where: { isPublished: true } });
    const totalAssignments = await db.assignment.count({ where: { isActive: true } });

    const data = students.map(student => {
      const attendanceRate = totalSessions > 0
        ? Math.round((student.attendances.length / totalSessions) * 100)
        : 0;

      const quizRate = totalQuizzes > 0
        ? Math.round((student.quizAttempts.length / totalQuizzes) * 100)
        : 0;

      const assignmentRate = totalAssignments > 0
        ? Math.round((student.assignmentSubmissions.length / totalAssignments) * 100)
        : 0;

      const avgQuizScore = student.quizAttempts.length > 0
        ? Math.round(
            student.quizAttempts.reduce((a, q) => a + (q.percentage ?? 0), 0) /
            student.quizAttempts.length
          )
        : 0;

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