import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET - get all pending enrollment requests
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requests = await db.$queryRaw<{
    id: string; studentId: string; subjectId: string;
    status: string; createdAt: string;
    studentCode: string; studentName: string; studentEmail: string; studentImage: string | null;
    departmentName: string; academicYear: number;
    subjectName: string; subjectCode: string; semester: number;
  }[]>`
    SELECT 
      er.id, er."studentId", er."subjectId", er.status, er."createdAt",
      st."studentCode", u.name as "studentName", u.email as "studentEmail", u.image as "studentImage",
      d.name as "departmentName", st."academicYear",
      s.name as "subjectName", s.code as "subjectCode", s.semester
    FROM enrollment_requests er
    JOIN students st ON st.id = er."studentId"
    JOIN users u ON u.id = st."userId"
    JOIN departments d ON d.id = st."departmentId"
    JOIN subjects s ON s.id = er."subjectId"
    WHERE er.status = 'PENDING'
    ORDER BY er."createdAt" DESC
  `;

  return NextResponse.json({ success: true, data: requests });
}

// POST - approve or reject an enrollment request
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { requestId, action } = await req.json(); // action: 'approve' | 'reject'
  if (!requestId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Get the request
  const requests = await db.$queryRaw<{ studentId: string; subjectId: string }[]>`
    SELECT "studentId", "subjectId" FROM enrollment_requests WHERE id = ${requestId} AND status = 'PENDING'
  `;
  if (requests.length === 0) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  const { studentId, subjectId } = requests[0];

  if (action === 'approve') {
    // Add to student_subjects (ignore if already exists)
    await db.$executeRaw`
      INSERT INTO student_subjects (id, "studentId", "subjectId", "enrolledAt")
      VALUES (gen_random_uuid()::text, ${studentId}, ${subjectId}, NOW())
      ON CONFLICT ("studentId", "subjectId") DO NOTHING
    `;
    // Update request status
    await db.$executeRaw`
      UPDATE enrollment_requests SET status = 'APPROVED', "updatedAt" = NOW() WHERE id = ${requestId}
    `;
    // Notify student
    const student = await db.student.findUnique({ where: { id: studentId }, select: { userId: true } });
    const subject = await db.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
    if (student && subject) {
      await db.notification.create({
        data: {
          userId: student.userId,
          title: '✅ Enrollment Approved',
          message: `Your enrollment request for "${subject.name}" has been approved.`,
          type: 'APPROVAL',
        },
      });
    }
  } else {
    // Reject
    await db.$executeRaw`
      UPDATE enrollment_requests SET status = 'REJECTED', "updatedAt" = NOW() WHERE id = ${requestId}
    `;
    const student = await db.student.findUnique({ where: { id: studentId }, select: { userId: true } });
    const subject = await db.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
    if (student && subject) {
      await db.notification.create({
        data: {
          userId: student.userId,
          title: '❌ Enrollment Rejected',
          message: `Your enrollment request for "${subject.name}" has been rejected.`,
          type: 'GENERAL',
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}
