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
  const studentsWithSemester = await Promise.all(students.map(async s => {
    const subjectSemesters = await db.subject.findMany({
      where: {
        departmentId: s.departmentId,
        academicYear: s.academicYear,
        isActive: true,
      },
      select: { semester: true },
    });
    // Get unique semesters from subjects
    const semesters = Array.from(new Set(subjectSemesters.map(sub => sub.semester)));
    return { ...s, semesters };
  }));

  return NextResponse.json({
    success: true,
    data: studentsWithSemester,
    pagination: { page, limit, total, pages: limit ? Math.ceil(total / limit) : 1 },
  });
}
