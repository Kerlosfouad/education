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
      select: { fileUrl: true },
    });

    if (!submission || !submission.fileUrl) {
      return new NextResponse('File not found', { status: 404 });
    }

    const fileUrl = submission.fileUrl;

    // If it's a web URL (UploadThing / CDN / S3), redirect
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return NextResponse.redirect(fileUrl);
    }

    // If it's a base64 Data URL (e.g. data:application/pdf;base64,...)
    if (fileUrl.startsWith('data:')) {
      const parts = fileUrl.split(';base64,');
      if (parts.length === 2) {
        const mimeType = parts[0].replace('data:', '') || 'application/pdf';
        const buffer = Buffer.from(parts[1], 'base64');
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': 'inline; filename="submission.pdf"',
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    }

    return new NextResponse('Invalid file format', { status: 400 });
  } catch (error) {
    console.error('File serve error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
