export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent, getStudentSubjectAccess } from '@/lib/db';
import { notifyStudentsByFilter, notifyStudentsBySubject } from '@/lib/notifications';
import { cache } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');

    if (session.user.role === 'STUDENT') {
      const student = await getOrCreateStudent(session.user.id);
      if (!student) return NextResponse.json({ error: 'No department found' }, { status: 404 });

      const cacheKey = `student:quizzes:${student.id}:${subjectId || 'all'}`;
      const quizzesWithAttempts = await cache.remember(
        cacheKey,
        30, // 30 seconds
        async () => {
          const where: any = { isPublished: true };
          if (subjectId) where.subjectId = subjectId;

          const quizzes = await db.quiz.findMany({
            where,
            include: {
              subject: { include: { department: true } },
              _count: { select: { questions: true, attempts: true } },
            },
            orderBy: { createdAt: 'desc' },
          });

          const deptIds = Array.from(new Set(quizzes.map((q: any) => q.departmentId).filter(Boolean)));
          const depts = deptIds.length > 0
            ? await db.department.findMany({ where: { id: { in: deptIds as string[] } }, select: { id: true, name: true } })
            : [];
          const deptMap = Object.fromEntries(depts.map((d: any) => [d.id, d]));

          const quizIds = quizzes.map((q: any) => q.id);
          const quizSemesters = quizIds.length > 0
            ? await db.$queryRaw<{ id: string; semester: number | null }[]>`
                SELECT id, semester FROM quizzes WHERE id = ANY(${quizIds}::text[])
              `
            : [];
          const semesterMap = Object.fromEntries(quizSemesters.map(q => [q.id, q.semester]));

          const quizzesWithAll = quizzes.map((q: any) => ({
            ...q,
            department: q.departmentId ? deptMap[q.departmentId] ?? null : null,
            semester: semesterMap[q.id] ?? null,
          }));

          const { semester: studentSemester, subjectIds } = await getStudentSubjectAccess(student);
          const allowedSubjectIds = new Set(subjectIds);

          const filteredQuizzes = quizzesWithAll.filter((quiz: any) => {
            if (quiz.subjectId && allowedSubjectIds.has(quiz.subjectId)) return true;
            const matchDeptYear = quiz.departmentId === student.departmentId && quiz.academicYear === student.academicYear;
            if (!matchDeptYear) return false;
            if (quiz.semester && studentSemester && quiz.semester !== studentSemester) return false;
            if (!studentSemester || !quiz.subject) return true;
            return quiz.subject.semester === studentSemester;
          });

          // Single query for all attempts instead of N+1 queries
          const filteredQuizIds = filteredQuizzes.map((q: any) => q.id);
          const attempts = filteredQuizIds.length > 0
            ? await db.quizAttempt.findMany({
                where: { quizId: { in: filteredQuizIds }, studentId: student.id },
                orderBy: { startedAt: 'desc' },
              })
            : [];

          const attemptsByQuiz: Record<string, any[]> = {};
          attempts.forEach((a) => {
            if (!attemptsByQuiz[a.quizId]) attemptsByQuiz[a.quizId] = [];
            attemptsByQuiz[a.quizId].push(a);
          });

          return filteredQuizzes.map((quiz: any) => ({
            ...quiz,
            studentAttempts: attemptsByQuiz[quiz.id] || [],
          }));
        },
        [`student:${student.id}`, `quizzes`]
      );

      return NextResponse.json({ success: true, data: quizzesWithAttempts });
    }

    // Doctor/Admin view
    const where: any = {};
    if (subjectId) where.subjectId = subjectId;

    const quizzes = await db.quiz.findMany({
      where,
      include: {
        subject: { include: { department: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const deptIds = Array.from(new Set(quizzes.map((q: any) => q.departmentId).filter(Boolean)));
    const depts = deptIds.length > 0
      ? await db.department.findMany({ where: { id: { in: deptIds as string[] } }, select: { id: true, name: true } })
      : [];
    const deptMap = Object.fromEntries(depts.map((d: any) => [d.id, d]));

    const quizIds = quizzes.map((q: any) => q.id);
    const quizSemesters = quizIds.length > 0
      ? await db.$queryRaw<{ id: string; semester: number | null }[]>`
          SELECT id, semester FROM quizzes WHERE id = ANY(${quizIds}::text[])
        `
      : [];
    const semesterMap = Object.fromEntries(quizSemesters.map(q => [q.id, q.semester]));

    const quizzesWithAll = quizzes.map((q: any) => ({
      ...q,
      department: q.departmentId ? deptMap[q.departmentId] ?? null : null,
      semester: semesterMap[q.id] ?? null,
    }));

    return NextResponse.json({ success: true, data: quizzesWithAll });
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
    const { departmentId, academicYear, semester, title, description, timeLimit, maxAttempts, passingScore,
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

    // Save semester via raw SQL (field added directly to DB)
    if (semester) {
      await db.$executeRaw`UPDATE quizzes SET semester = ${Number(semester)} WHERE id = ${quiz.id}`;
    }

    if (isPublished && body.subjectId) {
      await notifyStudentsBySubject(
        'New Quiz Available',
        `A new quiz has been published: ${title}`,
        'QUIZ',
        body.subjectId
      );
    } else if (isPublished && departmentId && academicYear) {
      await notifyStudentsByFilter(
        'New Quiz Available',
        `A new quiz has been published: ${title}`,
        'QUIZ',
        departmentId,
        Number(academicYear)
      );
    }

    cache.invalidatePattern('student:quizzes:');
    cache.invalidateTag('quizzes');
    cache.delete('doctor:stats:summary');

    return NextResponse.json({ success: true, data: quiz }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
