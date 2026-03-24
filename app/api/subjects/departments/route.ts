import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Public endpoint - no auth required (used in register page)
export async function GET() {
  try {
    const departments = await db.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameAr: true, code: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ success: true, data: departments });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
