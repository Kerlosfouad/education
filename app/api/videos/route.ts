import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const slides = await db.lectureSlide.findMany({
      orderBy: { uploadedAt: 'desc' },
      include: { subject: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, data: slides });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const body = await req.json();
    const slide = await db.lectureSlide.create({
      data: { title: body.title, description: body.description, fileUrl: body.fileUrl, fileSize: body.fileSize, subjectId: body.subjectId || null, uploadedBy: session.user.id },
      include: { subject: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, data: slide });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false }, { status: 400 });
    await db.lectureSlide.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
