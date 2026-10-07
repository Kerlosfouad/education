export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getStudentSubjectAccess } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await db.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return NextResponse.json({ success: true, data: [] });
    const { semester, subjectIds } = await getStudentSubjectAccess(student);

    const assignments = await db.assignment.findMany({
      where: {
        isActive: true,
        OR: [
          {
            subjectId: { in: subjectIds },
          },
          {
            subjectId: null,
            departmentId: student.departmentId,
            academicYear: student.academicYear,
            ...(semester !== null && semester !== undefined ? { semester } : {}),
          },
          {
            subjectId: null,
            departmentId: null,
          },
        ],
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        submissions: {
          where: { studentId: student.id },
          select: { id: true, status: true, score: true, fileUrl: true },
        },
      },
      orderBy: { deadline: 'asc' },
    });

    return NextResponse.json({ success: true, data: assignments });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
