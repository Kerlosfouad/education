import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Use raw SQL to read fields that may not be in the stale Prisma client
  const profiles = await db.$queryRaw<any[]>`
    SELECT title, bio, phone, whatsapp, facebook, instagram, twitter
    FROM doctor_profiles WHERE "userId" = ${session.user.id}
  `;
  const p = profiles[0] || {};

  return NextResponse.json({
    success: true,
    data: {
      name: user.name,
      email: user.email,
      image: user.image,
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

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, image, title, bio, phone, whatsapp, facebook, instagram, twitter, currentPassword, newPassword } = body;

  // Handle password change
  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 });
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user?.password) return NextResponse.json({ error: 'No password set' }, { status: 400 });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    const hashed = await bcrypt.hash(newPassword, 12);
    await db.user.update({ where: { id: session.user.id }, data: { password: hashed } });
  }

  // Update user - never store base64 images in DB user.image field
  const safeImage = image?.startsWith('data:') ? undefined : image;
  await db.user.update({
    where: { id: session.user.id },
    data: { name, ...(safeImage !== undefined ? { image: safeImage } : {}) },
  });

  // Upsert doctor profile using raw SQL to bypass stale Prisma client types
  const existing = await db.doctorProfile.findUnique({ where: { userId: session.user.id } });
  if (existing) {
    await db.$executeRaw`
      UPDATE doctor_profiles
      SET title = ${title}, bio = ${bio},
          phone = ${phone ?? null}, whatsapp = ${whatsapp ?? null},
          facebook = ${facebook ?? null}, instagram = ${instagram ?? null},
          twitter = ${twitter ?? null}
      WHERE "userId" = ${session.user.id}
    `;
  } else {
    await db.$executeRaw`
      INSERT INTO doctor_profiles (id, "userId", title, bio, phone, whatsapp, facebook, instagram, twitter, specialties)
      VALUES (gen_random_uuid(), ${session.user.id}, ${title}, ${bio},
              ${phone ?? null}, ${whatsapp ?? null}, ${facebook ?? null},
              ${instagram ?? null}, ${twitter ?? null}, '{}')
    `;
  }

  return NextResponse.json({ success: true });
}
