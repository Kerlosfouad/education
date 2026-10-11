export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const submission = await db.assignmentSubmission.findUnique({
      where: { id: params.id },
      select: {
        fileUrl: true,
        student: {
          select: {
            studentCode: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!submission || !submission.fileUrl) {
      return new NextResponse('File not found', { status: 404 });
    }

    const { fetchFileBuffer, sanitizeFilename } = await import('@/lib/files');
    const { buffer, contentType } = await fetchFileBuffer(submission.fileUrl);

    const isPdf = contentType === 'application/pdf' || (buffer.length >= 4 && buffer.toString('utf8', 0, 4) === '%PDF');
    const ext = isPdf ? 'pdf' : (contentType.split('/')[1] || 'pdf');
    const studentName = submission.student?.user?.name || 'student';
    const studentCode = submission.student?.studentCode || params.id;
    const downloadName = `${studentName}_${studentCode}.${ext}`;
    const { safeAscii, utf8Name } = sanitizeFilename(downloadName, ext);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': isPdf ? 'application/pdf' : contentType,
        'Content-Disposition': `inline; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('File serve error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
