export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/cloudinary';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { fileData, folder, resourceType } = body;
      if (!fileData) {
        return NextResponse.json({ error: 'fileData is required' }, { status: 400 });
      }

      const result = await uploadToCloudinary(fileData, folder || 'general', resourceType || 'auto');
      return NextResponse.json({ success: true, ...result });
    }

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const folder = (formData.get('folder') as string) || 'general';

      if (!file) {
        return NextResponse.json({ error: 'File is required' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = file.type || 'application/octet-stream';
      const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;

      const result = await uploadToCloudinary(base64, folder, 'auto');
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 400 });
  } catch (error: any) {
    console.error('Cloudinary API upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
