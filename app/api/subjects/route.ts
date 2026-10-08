export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const academicYearRaw = searchParams.get('academicYear');
    const academicYear = academicYearRaw ? Number(academicYearRaw) : null;
    const semesterRaw = searchParams.get('semester');
    const semester = semesterRaw ? Number(semesterRaw) : null;

    const cacheKey = `subjects:dept:${departmentId || 'all'}:yr:${academicYear ?? 'all'}:sem:${semester ?? 'all'}`;

    const subjects = await cache.remember(
      cacheKey,
      600, // 10 minutes
      async () => {
        return db.subject.findMany({
          where: {
            isActive: true,
            ...(departmentId ? { departmentId } : {}),
            ...(academicYear !== null ? { academicYear } : {}),
            ...(semester !== null ? { semester } : {}),
          },
          select: {
            id: true,
            name: true,
            code: true,
            departmentId: true,
            academicYear: true,
            semester: true,
            department: { select: { name: true } },
          },
          orderBy: { name: 'asc' },
        });
      },
      ['subjects']
    );

    return NextResponse.json(
      { success: true, data: subjects },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
