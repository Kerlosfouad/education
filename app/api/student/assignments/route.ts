import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

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

    const assignments = await db.assignment.findMany({
      where: {
        OR: [
          { departmentId: student.departmentId, academicYear: student.academicYear, subjectId: { in: subjectIds } },
          { departmentId: student.departmentId, academicYear: student.academicYear, subjectId: null },
          { departmentId: null },
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
    return NextResponse.json({ success: true, data: assignments });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
