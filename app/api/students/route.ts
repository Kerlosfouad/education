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
  const semesterRows = studentIds.length > 0
    ? await db.$queryRaw<{ id: string; semester: number }[]>`
        SELECT id, semester FROM students WHERE id = ANY(${studentIds}::text[])
      `
    : [];
  const semesterMap = Object.fromEntries(semesterRows.map(r => [r.id, r.semester]));

  const studentsWithSemester = await Promise.all(students.map(async s => {
    const studentSemester = semesterMap[s.id] ?? 1;
    const subjectData = await db.subject.findMany({
      where: {
        departmentId: s.departmentId,
        academicYear: s.academicYear,
        semester: studentSemester,
        isActive: true,
      },
      select: { semester: true, name: true },
    });
    const semesters = Array.from(new Set(subjectData.map(sub => sub.semester)));
    const subjects = subjectData.map(sub => sub.name);
    return { ...s, semester: studentSemester, semesters, subjects };
  }));

  return NextResponse.json({
    success: true,
    data: studentsWithSemester,
    pagination: { page, limit, total, pages: limit ? Math.ceil(total / limit) : 1 },
  });
}
