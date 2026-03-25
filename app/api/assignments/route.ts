import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const student = await db.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return NextResponse.json({ success: true, data: [] });
    const assignments = await db.assignment.findMany({
      where: { OR: [{ departmentId: student.departmentId }, { departmentId: null }] },
      include: { subject: { select: { name: true } }, submissions: { where: { studentId: student.id } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, data: assignments });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
