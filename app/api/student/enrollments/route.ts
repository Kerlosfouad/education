import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET - get enrolled subjects + pending requests for current student
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [enrollments, requests] = await Promise.all([
    db.$queryRaw<{
      id: string; subjectId: string; subjectName: string; subjectCode: string;
      semester: number; enrolledAt: string;
    }[]>`
      SELECT ss.id, ss."subjectId", s.name as "subjectName", s.code as "subjectCode",
             s.semester, ss."enrolledAt"
      FROM student_subjects ss
      JOIN subjects s ON s.id = ss."subjectId"
      WHERE ss."studentId" = ${student.id}
      ORDER BY ss."enrolledAt" DESC
    `,
    db.$queryRaw<{
      id: string; subjectId: string; subjectName: string; subjectCode: string;
      semester: number; status: string; createdAt: string;
    }[]>`
      SELECT er.id, er."subjectId", s.name as "subjectName", s.code as "subjectCode",
             s.semester, er.status, er."createdAt"
      FROM enrollment_requests er
      JOIN subjects s ON s.id = er."subjectId"
      WHERE er."studentId" = ${student.id}
      ORDER BY er."createdAt" DESC
    `,
  ]);

  return NextResponse.json({ success: true, data: { enrollments, requests } });
}

// POST - request enrollment in a subject (sends pending request)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subjectId } = await req.json();
  if (!subjectId) return NextResponse.json({ error: 'subjectId required' }, { status: 400 });

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify subject is available (same dept or PREP)
  const prepDept = await db.department.findFirst({ where: { code: 'PREP' } });
  const subject = await db.subject.findFirst({
    where: {
      id: subjectId,
      isActive: true,
      OR: [
        { departmentId: student.departmentId },
        ...(prepDept ? [{ departmentId: prepDept.id }] : []),
      ],
    },
  });
  if (!subject) return NextResponse.json({ error: 'Subject not available' }, { status: 403 });

  // Check already enrolled
  const alreadyEnrolled = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM student_subjects WHERE "studentId" = ${student.id} AND "subjectId" = ${subjectId}
  `;
  if (alreadyEnrolled.length > 0) return NextResponse.json({ error: 'Already enrolled' }, { status: 409 });

  // Check existing request
  const existingRequest = await db.$queryRaw<{ id: string; status: string }[]>`
    SELECT id, status FROM enrollment_requests WHERE "studentId" = ${student.id} AND "subjectId" = ${subjectId}
  `;
  if (existingRequest.length > 0) {
    if (existingRequest[0].status === 'PENDING') return NextResponse.json({ error: 'Request already pending' }, { status: 409 });
    // If rejected before, allow re-request
    await db.$executeRaw`
      UPDATE enrollment_requests SET status = 'PENDING', "updatedAt" = NOW()
      WHERE "studentId" = ${student.id} AND "subjectId" = ${subjectId}
    `;
    return NextResponse.json({ success: true, status: 'PENDING' });
  }

  // Create new request
  await db.$executeRaw`
    INSERT INTO enrollment_requests (id, "studentId", "subjectId", status, "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${student.id}, ${subjectId}, 'PENDING', NOW(), NOW())
  `;

  // Notify doctor
  const doctor = await db.user.findFirst({ where: { role: 'DOCTOR' } });
  if (doctor) {
    await db.notification.create({
      data: {
        userId: doctor.id,
        title: '📚 New Subject Enrollment Request',
        message: `Student ${student.studentCode} requested to enroll in "${subject.name}"`,
        type: 'GENERAL',
      },
    });
  }

  return NextResponse.json({ success: true, status: 'PENDING' });
}

// DELETE - cancel enrollment or request
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subjectId } = await req.json();
  if (!subjectId) return NextResponse.json({ error: 'subjectId required' }, { status: 400 });

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.$executeRaw`DELETE FROM student_subjects WHERE "studentId" = ${student.id} AND "subjectId" = ${subjectId}`;
  await db.$executeRaw`DELETE FROM enrollment_requests WHERE "studentId" = ${student.id} AND "subjectId" = ${subjectId}`;

  return NextResponse.json({ success: true });
}
