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

    const student = await db.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return NextResponse.json({ success: true, data: [] });

    const assignments = await db.assignment.findMany({
      where: {
        isActive: true,
        departmentId: student.departmentId,
        academicYear: student.academicYear,
      },
      include: {
        subject: { select: { name: true } },
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
