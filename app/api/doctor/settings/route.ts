import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const doctor = await db.user.findFirst({
      where: { role: 'DOCTOR' },
      include: { doctorProfile: true },
    });
    if (!doctor) return NextResponse.json({ success: false }, { status: 404 });
    return NextResponse.json({ success: true, data: { name: doctor.name, email: doctor.email, image: doctor.image, title: doctor.doctorProfile?.title, bio: doctor.doctorProfile?.bio, phone: doctor.doctorProfile?.phone, whatsapp: doctor.doctorProfile?.whatsapp, facebook: doctor.doctorProfile?.facebook, instagram: doctor.doctorProfile?.instagram, twitter: doctor.doctorProfile?.twitter } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
    const body = await req.json();
    await db.user.update({ where: { id: session.user.id }, data: { name: body.name } });
    await db.doctorProfile.upsert({
      where: { userId: session.user.id },
      update: { title: body.title, bio: body.bio, phone: body.phone, whatsapp: body.whatsapp, facebook: body.facebook, instagram: body.instagram, twitter: body.twitter },
      create: { userId: session.user.id, title: body.title, bio: body.bio, phone: body.phone, whatsapp: body.whatsapp, facebook: body.facebook, instagram: body.instagram, twitter: body.twitter },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
