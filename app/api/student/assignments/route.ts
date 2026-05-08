import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const student = await db.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return NextResponse.json({ success: true, data: [] });

    // Get student's semester via raw SQL
    const semesterRows = await db.$queryRaw<{semester: number}[]>`SELECT semester FROM students WHERE id = ${student.id}`;
    const semester = semesterRows[0]?.semester ?? null;

    // Get enrolled subject IDs (if any), fallback to dept+year+semester
    const enrolled = await db.$queryRaw<{ subjectId: string }[]>`
      SELECT "subjectId" FROM student_subjects WHERE "studentId" = ${student.id}
    `;
    let subjectIds: string[];
    if (enrolled.length > 0) {
      subjectIds = enrolled.map(e => e.subjectId);
    } else {
      const subjectWhere: any = { departmentId: student.departmentId, academicYear: student.academicYear };
      if (semester) subjectWhere.semester = semester;
      const subjects = await db.subject.findMany({ where: subjectWhere, select: { id: true } });
      subjectIds = subjects.map(s => s.id);
    }

    const now = new Date();
    const assignments = await db.assignment.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [
              { departmentId: student.departmentId, academicYear: student.academicYear, subjectId: { in: subjectIds } },
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
      const ids = assignments.map(a => `'${a.id}'`).join(',');
      const startDateRows = await db.$queryRaw<{ id: string; startDate: Date | null }[]>`
        SELECT id, "startDate" FROM assignments WHERE id IN (${Prisma.raw(ids)})
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
