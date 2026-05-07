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
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch department names for quizzes that have departmentId
    const deptIds = Array.from(new Set(quizzes.map((q: any) => q.departmentId).filter(Boolean)));
    const depts = deptIds.length > 0
      ? await db.department.findMany({ where: { id: { in: deptIds as string[] } }, select: { id: true, name: true } })
      : [];
    const deptMap = Object.fromEntries(depts.map((d: any) => [d.id, d]));
    const quizzesWithDept = quizzes.map((q: any) => ({
      ...q,
      department: q.departmentId ? deptMap[q.departmentId] ?? null : null,
    }));

    if (session.user.role === 'STUDENT') {
      const student = await getOrCreateStudent(session.user.id);
      if (!student) return NextResponse.json({ error: 'No department found' }, { status: 404 });

      const semesterRows = await db.$queryRaw<{semester: number}[]>`SELECT semester FROM students WHERE id = ${student.id}`;
      const studentSemester = semesterRows[0]?.semester ?? null;

      // Get enrolled subject IDs (if any)
      const enrolled = await db.$queryRaw<{ subjectId: string }[]>`
        SELECT "subjectId" FROM student_subjects WHERE "studentId" = ${student.id}
      `;
      const enrolledIds = enrolled.length > 0 ? new Set(enrolled.map(e => e.subjectId)) : null;

      const quizzesWithAttempts = await Promise.all(
        quizzesWithDept
          .filter((quiz: any) => {
            const matchDeptYear = quiz.departmentId === student.departmentId && quiz.academicYear === student.academicYear;
            if (!matchDeptYear) return false;
            // If enrolled subjects exist, filter by them
            if (enrolledIds && quiz.subjectId) return enrolledIds.has(quiz.subjectId);
            if (!studentSemester || !quiz.subject) return true;
            return quiz.subject.semester === studentSemester;
          })
          .map(async (quiz: any) => {
            const attempts = await db.quizAttempt.findMany({
              where: { quizId: quiz.id, studentId: student.id },
              orderBy: { startedAt: 'desc' },
            });
            return { ...quiz, studentAttempts: attempts };
          })
      );
      return NextResponse.json({ success: true, data: quizzesWithAttempts });
    }

    return NextResponse.json({ success: true, data: quizzesWithDept });
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