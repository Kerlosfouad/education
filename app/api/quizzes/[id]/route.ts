export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canStudentAccessScopedContent, db, getOrCreateStudent } from '@/lib/db';
import { notifyStudentsByFilter, notifyStudentsBySubject } from '@/lib/notifications';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const quiz = await db.quiz.findUnique({
      where: { id: params.id },
      include: {
        subject: true,
        questions: { orderBy: { order: 'asc' } },
        _count: { select: { attempts: true } },
      },
    });

    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    // Student: hide correct answers
    if (session.user.role === 'STUDENT') {
      const student = await getOrCreateStudent(session.user.id);
      if (!student) return NextResponse.json({ error: 'No department found' }, { status: 404 });
      if (!quiz.isPublished) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

      const semesterRows = await db.$queryRaw<{ semester: number | null }[]>`
        SELECT semester FROM quizzes WHERE id = ${params.id}
      `;
      const hasAccess = await canStudentAccessScopedContent(student, {
        subjectId: quiz.subjectId,
        departmentId: quiz.departmentId,
        academicYear: quiz.academicYear,
        semester: semesterRows[0]?.semester ?? null,
      });
      if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const safeQuestions = quiz.questions.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        points: q.points,
        order: q.order,
      }));

      // Include student's previous attempts
      const studentAttempts = await db.quizAttempt.findMany({
            where: { quizId: params.id, studentId: student.id },
            orderBy: { startedAt: 'desc' },
          });

      return NextResponse.json({ success: true, data: { ...quiz, questions: safeQuestions, studentAttempts } });
    }

    return NextResponse.json({ success: true, data: quiz });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // If publishing for the first time, send notification
    if (body.isPublished === true) {
      const existing = await db.quiz.findUnique({
        where: { id: params.id },
        select: { isPublished: true, title: true, subjectId: true, departmentId: true, academicYear: true },
      });
      if (existing && !existing.isPublished && existing.subjectId) {
        await notifyStudentsBySubject(
          'New Quiz Available',
          `A new quiz has been published: ${existing.title}`,
          'QUIZ',
          existing.subjectId
        );
      } else if (existing && !existing.isPublished && existing.departmentId && existing.academicYear) {
        await notifyStudentsByFilter(
          'New Quiz Available',
          `A new quiz has been published: ${existing.title}`,
          'QUIZ',
          existing.departmentId,
          existing.academicYear
        );
      }
    }

    const quiz = await db.quiz.update({
      where: { id: params.id },
      data: body,
    });

    return NextResponse.json({ success: true, data: quiz });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.quiz.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
