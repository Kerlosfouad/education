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

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    if (!data.title || !data.departmentId || data.academicYear === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const created = await db.assignment.create({
      data: {
        title: data.title,
        description: data.description || null,
        fileUrl: data.fileUrl || null,
        departmentId: data.departmentId,
        academicYear: Number(data.academicYear),
        semester: Number(data.semester || 1),
        subjectId: data.subjectId || null,
        deadline: new Date(data.deadline),
        allowUpload: true,
      },
    });

    if (data.startDate) {
      try {
        await db.$executeRaw`
          UPDATE assignments SET "startDate" = ${new Date(data.startDate)} WHERE id = ${created.id}
        `;
      } catch (e) {
        console.warn('Could not update startDate:', e);
      }
    }

    let subjectName = '';
    if (data.subjectId) {
      try {
        const subj = await db.subject.findUnique({ where: { id: data.subjectId }, select: { name: true } });
        if (subj?.name) subjectName = ` (${subj.name})`;
      } catch {}
    }

    try {
      const { notifyStudentsByFilter } = await import('@/lib/notifications');
      await notifyStudentsByFilter(
        `📝 New Assignment${subjectName}`,
        `A new assignment has been published: ${data.title}${subjectName}. Please submit your work before the deadline.`,
        'ASSIGNMENT',
        data.departmentId,
        Number(data.academicYear)
      );
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error('Assignment create POST error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to save assignment' }, { status: 500 });
  }
}
