import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { notifyAllStudents, notifyStudentsByFilter } from '@/lib/notifications';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Students should only see videos for their department/year (plus "General" videos with no subject).
    let studentFilter: { departmentId: string; academicYear: number } | null = null;
    if (session.user.role === 'STUDENT') {
      const student = await db.student.findUnique({
        where: { userId: session.user.id },
        select: { departmentId: true, academicYear: true },
      });
      if (student) studentFilter = student;
    }

    const videos = await db.lectureSlide.findMany({
      where: {
        fileType: 'video',
        ...(studentFilter
          ? {
              OR: [
                { subjectId: null },
                { subject: { departmentId: studentFilter.departmentId, academicYear: studentFilter.academicYear } },
              ],
            }
          : {}),
      },
      include: { subject: { select: { name: true } } },
      orderBy: { uploadedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: videos });
  } catch (error) {
    console.error(error);
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
    const { title, description, subjectId, fileUrl, fileSize } = body;

    if (!title || !fileUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const video = await db.lectureSlide.create({
      data: {
        title,
        description: description || '',
        ...(subjectId ? { subjectId } : {}),
        fileUrl,
        fileType: 'video',
        fileSize: fileSize ? Number(fileSize) : 0,
        uploadedBy: session.user.id,
        order: 0,
      },
    });

    // Notify filtered by subject's dept+year if available, else all
    if (subjectId) {
      const subject = await db.subject.findUnique({ where: { id: subjectId }, select: { departmentId: true, academicYear: true } });
      if (subject) {
        await notifyStudentsByFilter('🎬 New Video', `A new video was uploaded: ${title}`, 'ANNOUNCEMENT', subject.departmentId, subject.academicYear);
      }
    } else {
      await notifyAllStudents('🎬 New video', `A new video was uploaded: ${title}`, 'ANNOUNCEMENT');
    }

    return NextResponse.json({ success: true, data: video }, { status: 201 });
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

    await db.lectureSlide.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}