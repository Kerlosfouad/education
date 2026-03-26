import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// Public doctor info - accessible to any authenticated user (students, doctors, admins)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doctor = await db.user.findFirst({
    where: { role: 'DOCTOR' },
    select: { name: true, email: true, image: true },
  });

  if (!doctor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const profiles = await db.$queryRaw<any[]>`
    SELECT title, bio, phone, whatsapp, facebook, instagram, twitter
    FROM doctor_profiles LIMIT 1
  `;
  const p = profiles[0] || {};

  return NextResponse.json({
    success: true,
    data: {
      name: doctor.name,
      email: doctor.email,
      image: doctor.image,
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
