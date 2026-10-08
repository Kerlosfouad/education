export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent, getStudentSubjectAccess } from '@/lib/db';
import { notifyAllStudents, notifyStudentsBySubject } from '@/lib/notifications';
import { cache } from '@/lib/cache';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const cacheKey = `videos:${session.user.role}:${session.user.id}`;
    const videos = await cache.remember(
      cacheKey,
      60, // 60 seconds
      async () => {
        // Students should only see videos for their accessible subjects, plus general videos.
        let studentSubjectIds: string[] | null = null;
        if (session.user.role === 'STUDENT') {
          const student = await getOrCreateStudent(session.user.id);
          if (student) {
            const access = await getStudentSubjectAccess(student);
            studentSubjectIds = access.subjectIds;
          }
        }

        return db.lectureSlide.findMany({
          where: {
            fileType: 'video',
            ...(studentSubjectIds
              ? {
                  OR: [
                    { subjectId: null },
                    { subjectId: { in: studentSubjectIds } },
                  ],
                }
              : {}),
          },
          include: { subject: { select: { name: true } } },
          orderBy: { uploadedAt: 'desc' },
        });
      },
      ['videos']
    );

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

    if (subjectId) {
      await notifyStudentsBySubject('New Video', `A new video was uploaded: ${title}`, 'ANNOUNCEMENT', subjectId);
    } else {
      await notifyAllStudents('New video', `A new video was uploaded: ${title}`, 'ANNOUNCEMENT');
    }

    cache.invalidatePattern('videos:');
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
    cache.invalidatePattern('videos:');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
