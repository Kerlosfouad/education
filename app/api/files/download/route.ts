export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { fetchFileBuffer, sanitizeFilename } from '@/lib/files';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get('url');
    const filenameParam = searchParams.get('filename') || 'document.pdf';
    const mode = searchParams.get('mode') === 'inline' ? 'inline' : 'attachment';

    if (!fileUrl) {
      return new NextResponse('Missing file url', { status: 400 });
    }

    const { buffer, contentType } = await fetchFileBuffer(fileUrl);
    const isPdf = contentType === 'application/pdf' || (buffer.length >= 4 && buffer.toString('utf8', 0, 4) === '%PDF');
    const ext = isPdf ? 'pdf' : (contentType.split('/')[1] || 'pdf');

    const { safeAscii, utf8Name } = sanitizeFilename(filenameParam, ext);

    const headers = new Headers();
    headers.set('Content-Type', isPdf ? 'application/pdf' : contentType);
    headers.set('Content-Disposition', `${mode}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`);
    headers.set('Content-Length', buffer.length.toString());
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('File download proxy error:', error);
    return new NextResponse(error?.message || 'Error downloading file', { status: 500 });
  }
}
