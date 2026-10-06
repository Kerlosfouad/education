export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET: fetch students + their grades for a subject
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const subjectId = req.nextUrl.searchParams.get('subjectId');
  if (!subjectId) return NextResponse.json({ error: 'subjectId required' }, { status: 400 });

  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, name: true, departmentId: true, academicYear: true, semester: true },
  });
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

  // Get students enrolled in this subject:
  // 1. Explicitly enrolled via student_subjects
  // 2. OR legacy students (0 records in student_subjects) matching dept + academicYear + semester
  const students = await db.$queryRaw<{ id: string; name: string; studentCode: string }[]>`
    SELECT st.id, u.name, st."studentCode"
    FROM students st
    JOIN users u ON u.id = st."userId"
    WHERE u.status = 'ACTIVE'
      AND (
        EXISTS (
          SELECT 1 FROM student_subjects ss
          WHERE ss."studentId" = st.id AND ss."subjectId" = ${subjectId}
        )
        OR (
          NOT EXISTS (SELECT 1 FROM student_subjects ss2 WHERE ss2."studentId" = st.id)
          AND st."departmentId" = ${subject.departmentId}
          AND st."academicYear" = ${subject.academicYear}
          AND st.semester = ${subject.semester}
        )
      )
    ORDER BY u.name ASC
  `;

  const now = new Date();
  const studentIds = students.map(s => s.id);

  // 1. Assignments & Submissions
  const assignments = await db.assignment.findMany({
    where: {
      isActive: true,
      OR: [
        { subjectId },
        { departmentId: subject.departmentId, academicYear: subject.academicYear, subjectId: null },
      ],
    },
    select: { id: true, title: true, maxScore: true },
  });
  const assignmentIds = assignments.map(a => a.id);
  const submissions = assignmentIds.length > 0 && studentIds.length > 0
    ? await db.assignmentSubmission.findMany({
        where: {
          assignmentId: { in: assignmentIds },
          studentId: { in: studentIds },
          status: 'GRADED',
        },
        include: { assignment: { select: { title: true, maxScore: true } } },
        orderBy: { submittedAt: 'desc' },
      })
    : [];

  // 2. Quizzes & Attempts
  const quizzes = await db.quiz.findMany({
    where: {
      OR: [
        { subjectId },
        { departmentId: subject.departmentId, academicYear: subject.academicYear, subjectId: null },
      ],
    },
    select: { id: true, title: true },
  });
  const quizIds = quizzes.map(q => q.id);
  const quizAttempts = quizIds.length > 0 && studentIds.length > 0
    ? await db.quizAttempt.findMany({
        where: {
          quizId: { in: quizIds },
          studentId: { in: studentIds },
          status: 'COMPLETED',
        },
        include: { quiz: { select: { title: true } } },
        orderBy: { completedAt: 'desc' },
      })
    : [];

  // 3. Attendance Sessions & Records
  const attendanceSessions = await db.attendanceSession.findMany({
    where: {
      closeTime: { lt: now },
      OR: [
        { subjectId },
        { departmentId: subject.departmentId, academicYear: subject.academicYear, subjectId: null },
      ],
    },
    select: { id: true },
  });
  const sessionIds = attendanceSessions.map(s => s.id);
  const attendances = sessionIds.length > 0 && studentIds.length > 0
    ? await db.attendance.findMany({
        where: {
          sessionId: { in: sessionIds },
          studentId: { in: studentIds },
          verificationMethod: { not: 'ABSENT' },
        },
        select: { studentId: true },
      })
    : [];

  const grades = await db.examResult.findMany({
    where: { subjectId },
  });

  const gradeMap: Record<string, Record<string, number>> = {};
  grades.forEach(g => {
    if (!gradeMap[g.studentId]) gradeMap[g.studentId] = {};
    gradeMap[g.studentId][g.examType] = g.score;
  });

  const studentsWithActivity = students.map(s => {
    // Latest graded assignment
    const studentSubs = submissions.filter(sub => sub.studentId === s.id);
    const latestSub = studentSubs[0];
    const assignmentActivity = latestSub && latestSub.score !== null ? {
      score: latestSub.score,
      maxScore: latestSub.assignment.maxScore ?? 100,
      percentage: Math.round((latestSub.score / (latestSub.assignment.maxScore || 100)) * 100),
      title: latestSub.assignment.title,
    } : null;

    // Latest completed quiz
    const studentQuizzes = quizAttempts.filter(qa => qa.studentId === s.id);
    const latestQuiz = studentQuizzes[0];
    const quizActivity = latestQuiz && latestQuiz.score !== null ? {
      score: latestQuiz.score,
      maxScore: latestQuiz.maxScore ?? 100,
      percentage: latestQuiz.percentage ?? Math.round((latestQuiz.score / (latestQuiz.maxScore || 100)) * 100),
      title: latestQuiz.quiz.title,
    } : null;

    // Attendance
    const attendedCount = attendances.filter(a => a.studentId === s.id).length;
    const totalSessions = sessionIds.length;
    const attendancePct = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 100;
    const attendanceActivity = {
      attended: attendedCount,
      total: totalSessions,
      percentage: attendancePct,
    };

    return {
      id: s.id,
      name: s.name,
      studentCode: s.studentCode,
      grades: gradeMap[s.id] || {},
      activityScores: {
        ASSIGNMENT: assignmentActivity,
        QUIZ: quizActivity,
        ATTENDANCE: attendanceActivity,
      },
    };
  });

  return NextResponse.json({
    success: true,
    subject,
    students: studentsWithActivity,
  });
}

// POST/PATCH: upsert a grade
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subjectId, studentId, examType, score, maxScore, semester, academicYear } = await req.json();

  if (!subjectId || !studentId || !examType || score === undefined)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  if (typeof score !== 'number' || score < 0)
    return NextResponse.json({ error: 'Invalid score value' }, { status: 400 });

  const max = maxScore ?? 100;
  if (typeof max !== 'number' || max <= 0)
    return NextResponse.json({ error: 'Invalid maxScore value' }, { status: 400 });

  if (score > max)
    return NextResponse.json({ error: 'Score cannot exceed maxScore' }, { status: 400 });

  const subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

  const pct = Math.round((score / max) * 100);

  const grade = await db.examResult.upsert({
    where: { subjectId_studentId_examType_semester_academicYear: {
      subjectId, studentId, examType,
      semester: semester ?? subject.semester,
      academicYear: academicYear ?? subject.academicYear,
    }},
    update: { score, maxScore: max, percentage: pct, publishedBy: session.user.id },
    create: {
      subjectId, studentId, examType, score, maxScore: max, percentage: pct,
      semester: semester ?? subject.semester,
      academicYear: academicYear ?? subject.academicYear,
      publishedBy: session.user.id,
    },
  });

  // Notify the student once after all grades are saved (not per exam type)
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { userId: true },
  });
  if (student) {
    // Delete old grade notifications for this subject to avoid duplicates
    await db.notification.deleteMany({
      where: { userId: student.userId, type: 'EXAM_RESULT', message: { contains: subject.name } },
    });
    await db.notification.create({
      data: {
        userId: student.userId,
        title: '📊 Grade Published',
        message: `Your grades for ${subject.name} have been updated. Tap to view.`,
        type: 'EXAM_RESULT',
        data: { link: '/student/grades' },
      },
    });
  }

  return NextResponse.json({ success: true, grade });
}

// DELETE: clear all grades for a subject (or a specific student in a subject)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Try body first (for student-specific delete), then query params
  let subjectId: string | null = null;
  let studentId: string | null = null;

  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const body = await req.json();
      subjectId = body.subjectId ?? null;
      studentId = body.studentId ?? null;
    } catch {}
  }

  if (!subjectId) subjectId = req.nextUrl.searchParams.get('subjectId');
  if (!subjectId) return NextResponse.json({ error: 'subjectId required' }, { status: 400 });

  const where: any = { subjectId };
  if (studentId) where.studentId = studentId;

  await db.examResult.deleteMany({ where });

  // If deleting a specific student's grades, also delete related notifications
  if (studentId) {
    const student = await db.student.findUnique({ where: { id: studentId }, select: { userId: true } });
    if (student) {
      await db.notification.deleteMany({
        where: { userId: student.userId, type: 'EXAM_RESULT' },
      });
    }
  }

  return NextResponse.json({ success: true });
}
