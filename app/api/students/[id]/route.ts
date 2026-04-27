import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ success: false }, { status: 401 });
    }
    const student = await db.student.findUnique({ where: { id: params.id } });
    if (!student) return NextResponse.json({ success: false }, { status: 404 });
    await db.user.delete({ where: { id: student.userId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ success: false }, { status: 401 });
    }
    const student = await db.student.findUnique({ where: { id: params.id } });
    if (!student) return NextResponse.json({ success: false }, { status: 404 });
    const updated = await db.student.update({
      where: { id: params.id },
      data: { blocked: !(student as any).blocked },
    });
    return NextResponse.json({ success: true, blocked: (updated as any).blocked });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
