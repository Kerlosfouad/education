import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');

    const subjects = await db.subject.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
      },
      select: { id: true, name: true, code: true, departmentId: true, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ success: true, data: subjects });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
