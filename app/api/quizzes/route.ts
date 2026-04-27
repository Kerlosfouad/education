import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent } from '@/lib/db';
import { notifyStudentsByFilter } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');

    const where: any = {};
    if (subjectId) where.subjectId = subjectId;
    if (session.user.role === 'STUDENT') {
      where.isPublished = true;
    }

    const quizzes = await db.quiz.findMany({
      where,
      include: {
        subject: { include: { department: true } },
        department: { select: { name: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (session.user.role === 'STUDENT') {
      const student = await getOrCreateStudent(session.user.id);
      if (!student) return NextResponse.json({ error: 'No department found' }, { status: 404 });

      // filter quizzes by student's department AND academic year
      const quizzesWithAttempts = await Promise.all(
        quizzes
          .filter(quiz =>
            quiz.departmentId === student.departmentId &&
            quiz.academicYear === student.academicYear
          )
          .map(async (quiz) => {
            const attempts = await db.quizAttempt.findMany({
              where: { quizId: quiz.id, studentId: student.id },
              orderBy: { startedAt: 'desc' },
            });
            return { ...quiz, studentAttempts: attempts };
          })
      );
      return NextResponse.json({ success: true, data: quizzesWithAttempts });
    }

    return NextResponse.json({ success: true, data: quizzes });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { departmentId, academicYear, title, description, timeLimit, maxAttempts, passingScore,
      shuffleQuestions, showCorrectAnswers, startTime, endTime, questions, isPublished } = body;

    if (!departmentId || academicYear === undefined || academicYear === null || !title || !timeLimit || !questions || questions.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const quiz = await db.quiz.create({
      data: {
        departmentId,
        academicYear: Number(academicYear),
        title,
        description,
        timeLimit,
        maxAttempts: maxAttempts || 1,
        passingScore: passingScore || 60,
        shuffleQuestions: shuffleQuestions ?? true,
        showCorrectAnswers: showCorrectAnswers ?? true,
        isPublished: isPublished ?? false,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        questions: {
          create: questions.map((q: any, index: number) => ({
            type: q.type || 'MULTIPLE_CHOICE',
            question: q.question,
            options: q.options || [],
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || '',
            points: q.points || 1,
            order: index,
          })),
        },
      },
      include: { questions: true },
    });

    if (isPublished && departmentId && academicYear) {
      await notifyStudentsByFilter(
        'New Quiz Available',
        `A new quiz has been published: ${title}`,
        'QUIZ',
        departmentId,
        Number(academicYear)
      );
    }

    return NextResponse.json({ success: true, data: quiz }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}