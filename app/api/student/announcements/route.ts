import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const page = req.nextUrl.searchParams.get('page') || 'dashboard';

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { departmentId: true, academicYear: true },
  });

  const config = await db.systemConfig.findUnique({ where: { key: 'announcements' } });
  const all: any[] = (config?.value as any[]) || [];

  const filtered = all.filter(a => {
    // Filter by dept/year
    if (a.departmentId && a.departmentId !== student?.departmentId) return false;
    if (a.academicYear && a.academicYear !== student?.academicYear) return false;
    // Filter by target page: show if no targetPage (dashboard) or matches current page
    if (a.targetPage && a.targetPage !== page) return false;
    if (!a.targetPage && page !== 'dashboard') return false;
    return true;
  });

  return NextResponse.json({ success: true, data: filtered });
}
