export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/cache';

// Public endpoint - no auth required (used in register page and dropdowns)
export async function GET() {
  try {
    const departments = await cache.remember(
      'departments:active',
      3600, // 1 hour
      async () => {
        return db.department.findMany({
          where: { isActive: true },
          select: { id: true, name: true, nameAr: true, code: true },
          orderBy: { name: 'asc' },
        });
      },
      ['departments']
    );

    return NextResponse.json(
      { success: true, data: departments },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
