import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subjects = await db.subject.findMany({
    where: { isActive: true },
    include: { department: { select: { id: true, name: true, code: true } } },
    orderBy: [{ academicYear: 'asc' }, { semester: 'asc' }, { name: 'asc' }],
  });

  const departments = await db.department.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ success: true, subjects, departments });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, code, departmentId, academicYear, semester } = body;

  if (!name || !code || !departmentId || !academicYear || !semester) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const existing = await db.subject.findUnique({ where: { code } });
  if (existing) return NextResponse.json({ error: 'Subject code already exists' }, { status: 400 });

  const subject = await db.subject.create({
    data: { name, code, departmentId, academicYear: Number(academicYear), semester: Number(semester), isActive: true },
    include: { department: { select: { id: true, name: true, code: true } } },
  });

  return NextResponse.json({ success: true, subject });
}
