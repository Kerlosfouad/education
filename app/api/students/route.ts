export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam) : undefined;
  const skip = limit ? (page - 1) * limit : 0;

  const [students, total] = await Promise.all([
    db.student.findMany({
      where: { user: { status: 'ACTIVE' } },
      include: {
        user: { select: { name: true, email: true, image: true, status: true } },
        department: { select: { name: true } },
      },
      orderBy: { user: { name: 'asc' } },
      skip,
      ...(limit ? { take: limit } : {}),
    }),
    db.student.count({ where: { user: { status: 'ACTIVE' } } }),
  ]);

  // For each student, find which semesters they have subjects in
  // based on subjects matching their department + academicYear
  // Get semester for each student via raw SQL
  const studentIds = students.map(s => s.id);
  const [semesterRows, studentSubjectsRows] = await Promise.all([
    studentIds.length > 0
      ? db.$queryRaw<{ id: string; semester: number }[]>`
          SELECT id, semester FROM students WHERE id = ANY(${studentIds}::text[])
        `
      : Promise.resolve([]),
    studentIds.length > 0
      ? db.$queryRaw<{ studentId: string; id: string; name: string; code: string; semester: number }[]>`
          SELECT ss."studentId", s.id, s.name, s.code, s.semester
          FROM subjects s
          JOIN student_subjects ss ON ss."subjectId" = s.id
          WHERE ss."studentId" = ANY(${studentIds}::text[])
            AND s."isActive" = true
          ORDER BY s.semester, s.name
        `
      : Promise.resolve([]),
  ]);

  const semesterMap = Object.fromEntries(semesterRows.map(r => [r.id, r.semester]));
  const studentSubjectsMap: Record<string, { id: string; name: string; code: string; semester: number }[]> = {};
  for (const row of studentSubjectsRows) {
    if (!studentSubjectsMap[row.studentId]) studentSubjectsMap[row.studentId] = [];
    studentSubjectsMap[row.studentId].push({
      id: row.id,
      name: row.name,
      code: row.code,
      semester: row.semester,
    });
  }

  const studentsWithSemester = students.map(s => {
    const studentSemester = semesterMap[s.id] ?? 1;
    const subjectData = studentSubjectsMap[s.id] ?? [];

    const semesters = Array.from(new Set(subjectData.map(sub => sub.semester)));
    const subjects = subjectData.map(sub => sub.name);
    const enrolledSubjects = subjectData.map(sub => ({ id: sub.id, name: sub.name, code: sub.code }));

    return { ...s, semester: studentSemester, semesters, subjects, enrolledSubjects };
  });

  return NextResponse.json({
    success: true,
    data: studentsWithSemester,
    pagination: { page, limit, total, pages: limit ? Math.ceil(total / limit) : 1 },
  });
}
