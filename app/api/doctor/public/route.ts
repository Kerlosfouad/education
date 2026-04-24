import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Public doctor info - accessible without authentication.
export async function GET() {
  const doctor = await db.user.findFirst({
    where: { role: 'DOCTOR' },
    select: {
      name: true,
      email: true,
      image: true,
      doctorProfile: {
        select: {
          title: true,
          bio: true,
          phone: true,
          whatsapp: true,
          facebook: true,
          instagram: true,
          twitter: true,
        },
      },
    },
  });

  const empty = { name: '', email: '', image: '', title: '', bio: '', phone: '', whatsapp: '', facebook: '', instagram: '', twitter: '' };

  if (!doctor) {
    return NextResponse.json({ success: true, data: empty });
  }

  const p = doctor.doctorProfile;

  return NextResponse.json({
    success: true,
    data: {
      name: doctor.name || '',
      email: '',
      image: doctor.image?.startsWith('data:') ? '' : (doctor.image || ''),
      title: p?.title || '',
      bio: p?.bio || '',
      phone: p?.phone || '',
      whatsapp: p?.whatsapp || '',
      facebook: p?.facebook || '',
      instagram: p?.instagram || '',
      twitter: p?.twitter || '',
    },
  });
}
