import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'));
  const skip = (page - 1) * limit;

  const [students, total] = await Promise.all([
    db.student.findMany({
      where: { user: { status: 'ACTIVE' } },
      include: {
        user: { select: { name: true, email: true, image: true, status: true } },
        department: { select: { name: true } },
      },
      orderBy: { user: { name: 'asc' } },
      skip,
      take: limit,
    }),
    db.student.count({ where: { user: { status: 'ACTIVE' } } }),
  ]);

  return NextResponse.json({
    success: true,
    data: students,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
