export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/cache';

// GET /api/subjects/departments/levels?departmentId=xxx
// Returns distinct academic years (levels) for students in a department
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const cacheKey = `departments:levels:${departmentId || 'all'}`;

    const levels = await cache.remember(
      cacheKey,
      1800, // 30 minutes
      async () => {
        const where: any = { user: { status: 'ACTIVE' } };
        if (departmentId) where.departmentId = departmentId;

        const result = await db.student.findMany({
          where,
          select: { academicYear: true },
          distinct: ['academicYear'],
          orderBy: { academicYear: 'asc' },
        });

        return result.map((r: { academicYear: number }) => r.academicYear);
      },
      ['departments']
    );

    return NextResponse.json(
      { success: true, data: levels },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
