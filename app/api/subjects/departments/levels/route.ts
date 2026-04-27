import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/subjects/departments/levels?departmentId=xxx
// Returns distinct academic years (levels) for students in a department
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');

    const where: any = { user: { status: 'ACTIVE' } };
    if (departmentId) where.departmentId = departmentId;

    const result = await db.student.findMany({
      where,
      select: { academicYear: true },
      distinct: ['academicYear'],
      orderBy: { academicYear: 'asc' },
    });

    const levels = result.map((r: { academicYear: number }) => r.academicYear);
    return NextResponse.json({ success: true, data: levels });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
