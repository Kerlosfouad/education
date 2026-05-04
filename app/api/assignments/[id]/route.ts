import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/assignments/[id] - get submissions for an assignment
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assignment = await db.assignment.findUnique({
      where: { id: params.id },
      include: {
        subject: { select: { name: true } },
        submissions: {
          include: {
            student: {
              include: {
                user: { select: { name: true, email: true } },
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Fetch department separately since it's stored as raw field
    const raw = await db.$queryRaw<{ departmentId: string | null; academicYear: number | null }[]>`
      SELECT "departmentId", "academicYear" FROM assignments WHERE id = ${params.id}
    `;
    const { departmentId, academicYear } = raw[0] ?? {};
    let department = null;
    if (departmentId) {
      department = await db.department.findUnique({ where: { id: departmentId }, select: { name: true } });
    }

    // Get total submission count per student across all assignments
    const studentIds = assignment.submissions.map(s => s.student.id);
    const submissionCounts = studentIds.length > 0
      ? await db.assignmentSubmission.groupBy({
          by: ['studentId'],
          where: { studentId: { in: studentIds } },
          _count: { id: true },
        })
      : [];
    const submissionCountMap: Record<string, number> = {};
    for (const row of submissionCounts) {
      submissionCountMap[row.studentId] = row._count.id;
    }

    const submissionsWithCount = assignment.submissions.map(s => ({
      ...s,
      totalSubmissions: submissionCountMap[s.student.id] ?? 0,
    }));

    return NextResponse.json({ success: true, data: { ...assignment, submissions: submissionsWithCount, department, academicYear } });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/assignments/[id] - grade a submission
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { submissionId, score, feedback } = await req.json();
    if (!submissionId || score === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const updated = await db.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score: Number(score),
        feedback: feedback || null,
        gradedAt: new Date(),
        gradedBy: session.user.id,
        status: 'GRADED',
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT /api/assignments/[id] - update assignment max score
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { maxScore } = await req.json();
    if (maxScore === undefined || maxScore <= 0) {
      return NextResponse.json({ error: 'Invalid max score' }, { status: 400 });
    }

    const updated = await db.assignment.update({
      where: { id: params.id },
      data: { maxScore: Number(maxScore) },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/assignments/[id] - delete or toggle isActive
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    if (body.toggle) {
      const current = await db.assignment.findUnique({ where: { id: params.id }, select: { isActive: true } });
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const updated = await db.assignment.update({ where: { id: params.id }, data: { isActive: !current.isActive } });
      return NextResponse.json({ success: true, isActive: updated.isActive });
    }
    await db.assignment.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await db.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const fileUrl = body.fileUrl || null;

    const existing = await db.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: params.id, studentId: student.id } },
    });

    if (existing) {
      const updated = await db.assignmentSubmission.update({
        where: { id: existing.id },
        data: { fileUrl, status: 'SUBMITTED', submittedAt: new Date() },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    const submission = await db.assignmentSubmission.create({
      data: { assignmentId: params.id, studentId: student.id, fileUrl, status: 'SUBMITTED' },
    });

    return NextResponse.json({ success: true, data: submission }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
