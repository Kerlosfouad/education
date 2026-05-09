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
  // 1. Core: same dept + academicYear + semester
  // 2. Extra: explicitly enrolled via student_subjects
  const coreStudents = await db.$queryRaw<{ id: string; name: string; studentCode: string }[]>`
    SELECT st.id, u.name, st."studentCode"
    FROM students st
    JOIN users u ON u.id = st."userId"
    WHERE st."departmentId" = ${subject.departmentId}
      AND st."academicYear" = ${subject.academicYear}
      AND st.semester = ${subject.semester}
      AND u.status = 'ACTIVE'
    ORDER BY u.name ASC
  `;

  const coreIds = new Set(coreStudents.map(s => s.id));

  // Extra: explicitly enrolled in this subject but not in core
  const extraEnrolled = await db.$queryRaw<{ studentId: string }[]>`
    SELECT ss."studentId" FROM student_subjects ss WHERE ss."subjectId" = ${subjectId}
  `;
  const extraIds = extraEnrolled.map(e => e.studentId).filter(id => !coreIds.has(id));

  let extraStudents: { id: string; name: string; studentCode: string }[] = [];
  if (extraIds.length > 0) {
    extraStudents = await db.$queryRaw<{ id: string; name: string; studentCode: string }[]>`
      SELECT st.id, u.name, st."studentCode"
      FROM students st
      JOIN users u ON u.id = st."userId"
      WHERE st.id = ANY(${extraIds}::text[])
        AND u.status = 'ACTIVE'
      ORDER BY u.name ASC
    `;
  }

  const students = [...coreStudents, ...extraStudents];

  const grades = await db.examResult.findMany({
    where: { subjectId },
  });

  const gradeMap: Record<string, Record<string, number>> = {};
  grades.forEach(g => {
    if (!gradeMap[g.studentId]) gradeMap[g.studentId] = {};
    gradeMap[g.studentId][g.examType] = g.score;
  });

  return NextResponse.json({
    success: true,
    subject,
    students: students.map(s => ({
      id: s.id,
      name: s.name,
      studentCode: s.studentCode,
      grades: gradeMap[s.id] || {},
    })),
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
