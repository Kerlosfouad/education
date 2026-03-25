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
    const quizzes = await db.quiz.findMany({
      where: { isPublished: true },
      include: {
        subject: { select: { name: true } },
        _count: { select: { questions: true } },
        attempts: { where: { studentId: student.id }, select: { id: true, score: true, maxScore: true, percentage: true, status: true, completedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const data = quizzes.map(q => ({ ...q, studentAttempts: q.attempts }));
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
