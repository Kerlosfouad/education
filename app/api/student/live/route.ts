import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      select: { departmentId: true, academicYear: true },
    });

    const sessions = await db.zoomLecture.findMany({
      where: student ? {
        OR: [
          {
            subject: {
              departmentId: student.departmentId,
              academicYear: student.academicYear,
            },
          },
          { subjectId: null },
        ],
      } : {},
      include: { subject: { select: { name: true } } },
      orderBy: { scheduledAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
