import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch from Book model - same as doctor uploads
    const books = await db.book.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Map to a unified shape for the UI
    const data = books.map(b => ({
      id: b.id,
      title: b.name,
      author: null,
      description: null,
      category: b.type,
      fileUrl: b.url,
      externalUrl: null,
      subject: null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
