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
          select: { id: true, status: true, fileUrl: true, score: true, gradedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Ensure startDate is properly attached from Prisma field or raw SQL
    const ids = assignments.map(a => a.id);
    let startDateMap: Record<string, Date | null> = {};
    if (ids.length > 0) {
      try {
        const startDateRows = await db.$queryRaw<{ id: string; startDate: Date | null }[]>`
          SELECT id, "startDate" FROM assignments WHERE id = ANY(${ids}::text[])
        `;
        startDateMap = Object.fromEntries(startDateRows.map(r => [r.id, r.startDate]));
      } catch (e) {
        console.warn('Could not query raw startDate:', e);
      }
    }

    const assignmentsWithDates = assignments.map(a => {
      const rawSd = startDateMap[a.id];
      const finalStartDate = a.startDate
        ? new Date(a.startDate).toISOString()
        : (rawSd ? new Date(rawSd).toISOString() : (a.createdAt ? new Date(a.createdAt).toISOString() : null));
      return {
        ...a,
        startDate: finalStartDate,
      };
    });

    const filtered = assignmentsWithDates.filter(a => {
      if (!a.startDate) return true;
      return new Date(a.startDate) <= now;
    });

    return NextResponse.json({ success: true, data: filtered });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
