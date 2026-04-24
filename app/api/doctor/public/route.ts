import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Public doctor info - accessible without authentication.
export async function GET() {
  const doctor = await db.user.findFirst({
    where: { role: 'DOCTOR' },
    select: { name: true, email: true, image: true },
  });

  if (!doctor) {
    return NextResponse.json(
      {
        success: true,
        data: {
          name: '',
          email: '',
          image: '',
          title: '',
          bio: '',
          phone: '',
          whatsapp: '',
          facebook: '',
          instagram: '',
          twitter: '',
        },
      },
      { status: 200 }
    );
  }

  const profiles = await db.$queryRaw<any[]>`
    SELECT title, bio, phone, whatsapp, facebook, instagram, twitter
    FROM doctor_profiles LIMIT 1
  `;
  const p = profiles[0] || {};

  return NextResponse.json({
    success: true,
    data: {
      name: doctor.name,
      email: '',
      image: doctor.image?.startsWith('data:') ? '' : (doctor.image || ''),
      title: p.title || '',
      bio: p.bio || '',
      phone: p.phone || '',
      whatsapp: p.whatsapp || '',
      facebook: p.facebook || '',
      instagram: p.instagram || '',
      twitter: p.twitter || '',
    },
  });
}
