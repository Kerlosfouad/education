export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent } from '@/lib/db';
import { cache } from '@/lib/cache';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get student's department and level
    const student = await getOrCreateStudent(session.user.id);

    const cacheKey = `library:dept:${student?.departmentId || 'all'}:yr:${student?.academicYear ?? 'all'}`;
    const data = await cache.remember(
      cacheKey,
      300, // 5 minutes
      async () => {
        const books = await db.book.findMany({
          where: {
            OR: [
              { departmentId: null, academicYear: null },
              { departmentId: student?.departmentId ?? undefined, academicYear: null },
              { departmentId: null, academicYear: student?.academicYear ?? undefined },
              { departmentId: student?.departmentId ?? undefined, academicYear: student?.academicYear ?? undefined },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

        return books.map(b => ({
          id: b.id,
          title: b.name,
          author: null,
          description: null,
          category: b.type,
          fileUrl: b.url,
          externalUrl: null,
          subject: null,
        }));
      },
      ['books']
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
