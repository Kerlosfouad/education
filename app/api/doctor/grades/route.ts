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
    select: { id: true, name: true, departmentId: true, academicYear: true },
  });
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

  const students = await db.student.findMany({
    where: { departmentId: subject.departmentId, academicYear: subject.academicYear, user: { status: 'ACTIVE' } },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: 'asc' } },
  });

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
      name: s.user.name,
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

  const subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

  const max = maxScore ?? 100;
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

  return NextResponse.json({ success: true, grade });
}
