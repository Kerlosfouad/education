import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const quizId = req.nextUrl.searchParams.get('quizId');
  if (!quizId) return NextResponse.json({ error: 'quizId required' }, { status: 400 });

  const attempts = await db.quizAttempt.findMany({
    where: { quizId },
    include: {
      student: { include: { user: { select: { name: true } } } },
    },
    orderBy: { startedAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: attempts });
}
