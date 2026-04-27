import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// Doctor-specific data for logged-in doctors.
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isDoctor = session.user.role === 'DOCTOR';
  const isAdmin = session.user.role === 'ADMIN';

  // For ADMIN, we keep the current behavior: show first doctor.
  const doctorUser = isDoctor
    ? await db.user.findUnique({
      where: { id: session.user.id as string },
      select: { id: true, name: true, email: true, image: true, role: true },
    })
    : await db.user.findFirst({
      where: { role: 'DOCTOR' },
      select: { id: true, name: true, email: true, image: true, role: true },
    });

  if (!doctorUser) {
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
    FROM doctor_profiles
    WHERE "userId" = ${doctorUser.id}
    LIMIT 1
  `;
  const p = profiles[0] || {};

  return NextResponse.json({
    success: true,
    data: {
      name: doctorUser.name || '',
      email: doctorUser.email || '',
      image: doctorUser.image || '',
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

