export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getStudentSubjectAccess } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const student = await db.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return NextResponse.json({ success: true, data: [] });

    const { semester, subjectIds } = await getStudentSubjectAccess(student);

    const now = new Date();
    const assignments = await db.assignment.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [
              { subjectId: { in: subjectIds } },
              { departmentId: student.departmentId, academicYear: student.academicYear, subjectId: null, semester: semester ?? undefined },
              { departmentId: null },
            ],
          },
        ],
      },
      include: {
        subject: { select: { name: true } },
        submissions: {
          where: { studentId: student.id },
          select: { id: true, status: true, fileUrl: true, score: true, gradedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter out assignments whose startDate is in the future (raw SQL field)
    const filtered = assignments.length === 0 ? [] : await (async () => {
      const ids = assignments.map(a => a.id);
      const startDateRows = await db.$queryRaw<{ id: string; startDate: Date | null }[]>`
        SELECT id, "startDate" FROM assignments WHERE id = ANY(${ids}::text[])
      `;
      const startDateMap = Object.fromEntries(startDateRows.map(r => [r.id, r.startDate]));
      return assignments.filter(a => {
        const sd = startDateMap[a.id];
        return !sd || new Date(sd) <= now;
      });
    })();

    return NextResponse.json({ success: true, data: filtered });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
