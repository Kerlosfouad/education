export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; subjectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: studentId, subjectId } = params;

    // Verify student exists
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: { department: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Verify subject exists
    const subject = await db.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // Check if student has explicit enrollments in student_subjects
    const existingEnrollmentsCount = await db.studentSubject.count({
      where: { studentId: student.id },
    });

    // If student was a legacy student with 0 records in student_subjects,
    // initialize their other core subjects first so they don't lose access to them!
    if (existingEnrollmentsCount === 0) {
      const semesterRows = await db.$queryRaw<{ semester: number | null }[]>`
        SELECT semester FROM students WHERE id = ${student.id}
      `;
      const sem = semesterRows[0]?.semester ?? 1;

      const otherSubjects = await db.subject.findMany({
        where: {
          departmentId: student.departmentId,
          academicYear: student.academicYear,
          semester: sem,
          id: { not: subjectId },
          isActive: true,
        },
        select: { id: true },
      });

      for (const s of otherSubjects) {
        await db.$executeRaw`
          INSERT INTO student_subjects (id, "studentId", "subjectId", "enrolledAt")
          VALUES (gen_random_uuid(), ${student.id}, ${s.id}, NOW())
          ON CONFLICT ("studentId", "subjectId") DO NOTHING
        `.catch(() => {});
      }
    }

    // Now delete this subject from student_subjects and enrollment_requests
    await db.$executeRaw`
      DELETE FROM student_subjects
      WHERE "studentId" = ${student.id} AND "subjectId" = ${subject.id}
    `;

    await db.$executeRaw`
      DELETE FROM enrollment_requests
      WHERE "studentId" = ${student.id} AND "subjectId" = ${subject.id}
    `;

    return NextResponse.json({
      success: true,
      message: `Student removed from subject ${subject.name} successfully`,
    });
  } catch (error: any) {
    console.error('Error removing student from subject:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
