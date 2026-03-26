import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const student = await getOrCreateStudent(session.user.id);
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const existing = await db.attendance.findFirst({
      where: { studentId: student.id, sessionId },
    });
    if (existing) return NextResponse.json({ success: true });

    await db.attendance.create({
      data: {
        studentId: student.id,
        sessionId,
        verificationMethod: 'ABSENT',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
