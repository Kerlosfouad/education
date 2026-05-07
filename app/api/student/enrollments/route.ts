import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET - get enrolled subjects for current student
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const enrollments = await db.$queryRaw<{
    id: string; subjectId: string; subjectName: string; subjectCode: string;
    semester: number; enrolledAt: string;
  }[]>`
    SELECT ss.id, ss."subjectId", s.name as "subjectName", s.code as "subjectCode",
           s.semester, ss."enrolledAt"
    FROM student_subjects ss
    JOIN subjects s ON s.id = ss."subjectId"
    WHERE ss."studentId" = ${student.id}
    ORDER BY ss."enrolledAt" DESC
  `;

  return NextResponse.json({ success: true, data: enrollments });
}

// POST - enroll in a subject
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subjectId } = await req.json();
  if (!subjectId) return NextResponse.json({ error: 'subjectId required' }, { status: 400 });

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify subject is available to student:
  // 1. Subject belongs to student's department (any level) OR
  // 2. Subject belongs to PREP department (available to all)
  const prepDept = await db.department.findFirst({ where: { code: 'PREP' } });
  const subject = await db.subject.findFirst({
    where: {
      id: subjectId,
      isActive: true,
      OR: [
        { departmentId: student.departmentId },                          // same department, any level
        ...(prepDept ? [{ departmentId: prepDept.id }] : []),           // PREP subjects for everyone
      ],
    },
  });
  if (!subject) return NextResponse.json({ error: 'Subject not available' }, { status: 403 });

  // Check already enrolled
  const existing = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM student_subjects WHERE "studentId" = ${student.id} AND "subjectId" = ${subjectId}
  `;
  if (existing.length > 0) return NextResponse.json({ error: 'Already enrolled' }, { status: 409 });

  await db.$executeRaw`
    INSERT INTO student_subjects (id, "studentId", "subjectId", "enrolledAt")
    VALUES (gen_random_uuid()::text, ${student.id}, ${subjectId}, NOW())
  `;

  return NextResponse.json({ success: true });
}

// DELETE - unenroll from a subject
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subjectId } = await req.json();
  if (!subjectId) return NextResponse.json({ error: 'subjectId required' }, { status: 400 });

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.$executeRaw`
    DELETE FROM student_subjects WHERE "studentId" = ${student.id} AND "subjectId" = ${subjectId}
  `;

  return NextResponse.json({ success: true });
}
