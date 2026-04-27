import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { name: true, email: true, image: true } },
      department: { select: { name: true } },
    },
  });

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true, data: student });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, studentCode, departmentId, academicYear } = await request.json();
  if (!name?.trim() || !studentCode?.trim())
    return NextResponse.json({ error: 'Name and student code are required' }, { status: 400 });

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await Promise.all([
    db.user.update({ where: { id: session.user.id }, data: { name: name.trim() } }),
    db.student.update({
      where: { id: student.id },
      data: {
        studentCode: studentCode.trim(),
        ...(departmentId ? { departmentId } : {}),
        ...(academicYear !== undefined ? { academicYear: Number(academicYear) } : {}),
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
