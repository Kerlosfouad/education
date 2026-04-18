import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { departmentId: true, academicYear: true },
  });

  const config = await db.systemConfig.findUnique({ where: { key: 'announcements' } });
  const all: any[] = (config?.value as any[]) || [];

  // Filter: show if no dept/year restriction, or matches student's dept/year
  const filtered = all.filter(a => {
    if (!a.departmentId && !a.academicYear) return true;
    if (a.departmentId && a.departmentId !== student?.departmentId) return false;
    if (a.academicYear && a.academicYear !== student?.academicYear) return false;
    return true;
  });

  return NextResponse.json({ success: true, data: filtered });
}
