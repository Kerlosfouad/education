import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, code, departmentId, academicYear, semester } = body;

  const subject = await db.subject.update({
    where: { id: params.id },
    data: { name, code, departmentId, academicYear: Number(academicYear), semester: Number(semester) },
    include: { department: { select: { id: true, name: true, code: true } } },
  });

  return NextResponse.json({ success: true, subject });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.subject.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
