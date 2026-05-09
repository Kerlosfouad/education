import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { name: true, email: true, image: true } },
      department: { select: { name: true } },
    },
  });

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch semester via raw SQL since it may not be in generated Prisma types
  const semesterResult = await db.$queryRaw<{ semester: number }[]>`
    SELECT semester FROM students WHERE id = ${student.id}
  `;
  const semester = semesterResult[0]?.semester ?? 1;

  // Fetch enrolled subjects — only explicitly enrolled ones
  const enrolledSubjects = await db.$queryRaw<{ id: string; name: string; code: string; semester: number }[]>`
    SELECT s.id, s.name, s.code, s.semester
    FROM subjects s
    INNER JOIN student_subjects ss ON ss."subjectId" = s.id
    WHERE ss."studentId" = ${student.id}
    ORDER BY s.semester, s.name
  `;

  return NextResponse.json({ success: true, data: { ...student, semester, enrolledSubjects } });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, studentCode, departmentId, academicYear, semester } = await request.json();
  if (!name?.trim() || !studentCode?.trim())
    return NextResponse.json({ error: 'Name and student code are required' }, { status: 400 });

  // Validate student code: exactly 5 digits
  const codeStr = String(studentCode).trim();
  if (!/^\d{5}$/.test(codeStr))
    return NextResponse.json({ error: 'Student code must be exactly 5 digits' }, { status: 400 });

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await Promise.all([
    db.user.update({ where: { id: session.user.id }, data: { name: name.trim() } }),
    db.student.update({
      where: { id: student.id },
      data: {
        studentCode: codeStr,
        ...(departmentId ? { departmentId } : {}),
        ...(academicYear !== undefined ? { academicYear: Number(academicYear) } : {}),
      } as any,
    }),
  ]);

  // Update semester via raw SQL to bypass stale prisma types
  if (semester !== undefined) {
    await db.$executeRaw`UPDATE students SET semester = ${Number(semester)} WHERE id = ${student.id}`;
  }

  return NextResponse.json({ success: true });
}
