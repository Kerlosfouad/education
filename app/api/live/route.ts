import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { notifyAllStudents } from '@/lib/notifications';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sessions = await db.zoomLecture.findMany({
      include: { subject: { select: { name: true } } },
      orderBy: { scheduledAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subjectId, title, description, meetingUrl, meetingId, password, scheduledAt, duration } = body;

    if (!title || !meetingUrl || !scheduledAt || !duration || !subjectId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const lecture = await db.zoomLecture.create({
      data: {
        subjectId,
        title,
        description,
        meetingUrl,
        meetingId,
        password,
        scheduledAt: new Date(scheduledAt),
        duration: Number(duration),
      },
      include: { subject: { select: { name: true } } },
    });

    await notifyAllStudents(
      '🎥 New live session',
      `A live session was scheduled: ${title}`,
      'ANNOUNCEMENT'
    );

    return NextResponse.json({ success: true, data: lecture }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await db.zoomLecture.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
