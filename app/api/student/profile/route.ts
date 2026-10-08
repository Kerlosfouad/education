export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { cache } from '@/lib/cache';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await cache.remember(
    `student:profile:${session.user.id}`,
    60, // 60 seconds
    async () => {
      const student = await db.student.findUnique({
        where: { userId: session.user.id },
        include: {
          user: { select: { name: true, email: true, image: true } },
          department: { select: { name: true } },
        },
      });

      if (!student) return null;

      // Fetch semester via raw SQL since it may not be in generated Prisma types
      const semesterResult = await db.$queryRaw<{ semester: number }[]>`
        SELECT semester FROM students WHERE id = ${student.id}
      `;
      const semester = semesterResult[0]?.semester ?? 1;

      // Fetch enrolled subjects
      const enrolledSubjects = await db.$queryRaw<{ id: string; name: string; code: string; semester: number; status: string }[]>`
        SELECT s.id, s.name, s.code, s.semester, 'ENROLLED' as status
        FROM subjects s
        INNER JOIN student_subjects ss ON ss."subjectId" = s.id
        WHERE ss."studentId" = ${student.id}
          AND s."isActive" = true
        UNION
        SELECT s.id, s.name, s.code, s.semester, 'PENDING' as status
        FROM subjects s
        INNER JOIN enrollment_requests er ON er."subjectId" = s.id
        WHERE er."studentId" = ${student.id}
          AND er.status = 'PENDING'
          AND s."isActive" = true
        ORDER BY semester, name
      `;

      return { ...student, semester, enrolledSubjects };
    },
    [`student:${session.user.id}`]
  );

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name, studentCode, departmentId, academicYear, semester } = await request.json();
    if (!name?.trim() || !studentCode?.trim())
      return NextResponse.json({ error: 'Name and student code are required' }, { status: 400 });

    // Validate student code: exactly 5 digits
    const codeStr = String(studentCode).trim();
    if (!/^\d{5}$/.test(codeStr))
      return NextResponse.json({ error: 'Student code must be exactly 5 digits' }, { status: 400 });

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      include: { user: { select: { status: true } } },
    });
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Check if studentCode is taken by another ACTIVE student
    const existing = await db.student.findFirst({
      where: {
        studentCode: codeStr,
        id: { not: student.id },
        user: { status: 'ACTIVE' },
      },
    });
    if (existing) return NextResponse.json({ error: 'Student code already taken by another student' }, { status: 409 });

    await db.user.update({ where: { id: session.user.id }, data: { name: name.trim() } });

    const isApprovedStudent = student.user.status === 'ACTIVE' || !!student.approvedAt;
    const updateData: {
      studentCode: string;
      departmentId?: string;
      academicYear?: number;
      semester?: number;
    } = { studentCode: codeStr };

    if (!isApprovedStudent) {
      if (departmentId) updateData.departmentId = departmentId;
      if (academicYear !== undefined) updateData.academicYear = Number(academicYear);
      if (semester !== undefined) updateData.semester = Number(semester);

      if (updateData.academicYear !== undefined && (Number.isNaN(updateData.academicYear) || updateData.academicYear < 0 || updateData.academicYear > 5)) {
        return NextResponse.json({ error: 'Invalid academic year' }, { status: 400 });
      }

      if (updateData.semester !== undefined && ![1, 2].includes(updateData.semester)) {
        return NextResponse.json({ error: 'Invalid semester' }, { status: 400 });
      }
    }

    await db.student.update({ where: { id: student.id }, data: updateData });

    // Invalidate cached profile and related data
    cache.delete(`student:profile:${session.user.id}`);
    cache.delete(`student:full:${session.user.id}`);
    cache.delete(`student:user:${session.user.id}`);
    cache.invalidatePattern(`student:${student.id}`);
    cache.invalidatePattern(`student:access:${student.id}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Profile PATCH error:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Student code already taken' }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
