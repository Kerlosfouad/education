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
      where: {
        user: { status: 'ACTIVE' },
        studentCode: { not: '' },
      },
      include: {
        user: { select: { name: true } },
        attendances: { where: { verificationMethod: { not: 'ABSENT' } } },
        assignmentSubmissions: true,
        quizAttempts: { where: { status: 'COMPLETED' } },
      }
    });

    const data = await Promise.all(students.map(async student => {
      // Filter totals by student's own department and year
      const totalSessions = await db.attendanceSession.count({
        where: {
          OR: [
            { departmentId: null } as any,
            { departmentId: student.departmentId, academicYear: student.academicYear } as any,
            { departmentId: student.departmentId, academicYear: null } as any,
          ]
        }
      });
      const totalQuizzes = await db.quiz.count({
        where: {
          isPublished: true,
          OR: [
            { departmentId: null },
            { departmentId: student.departmentId, academicYear: student.academicYear },
          ]
        }
      });
      const totalAssignments = await db.assignment.count({
        where: {
          isActive: true,
          OR: [
            { departmentId: null },
            { departmentId: student.departmentId, academicYear: student.academicYear },
          ]
        }
      });

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
        ? Math.round(student.quizAttempts.reduce((a, q) => a + (q.percentage ?? 0), 0) / student.quizAttempts.length)
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
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}