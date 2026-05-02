import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const studentId = req.nextUrl.searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 });

  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { name: true, email: true } },
      department: { select: { name: true } },
      assignmentSubmissions: {
        include: {
          assignment: { select: { title: true, maxScore: true, subject: { select: { name: true } } } },
        },
        orderBy: { submittedAt: 'desc' },
      },
      quizAttempts: {
        where: { status: 'COMPLETED' },
        include: {
          quiz: { select: { title: true, subject: { select: { name: true } } } },
        },
        orderBy: { completedAt: 'desc' },
      },
      attendances: {
        include: {
          session: { select: { title: true, openTime: true, closeTime: true } },
        },
        orderBy: { timestamp: 'desc' },
      },
    },
  });

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true, data: student });
}
