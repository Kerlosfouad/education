import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// One-time cleanup endpoint - DELETE after use
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'DOCTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find STUDENT users with no student record (previously deleted students)
  const orphanUsers = await db.user.findMany({
    where: { role: 'STUDENT', student: null },
    select: { id: true, email: true, name: true, status: true },
  });

  if (orphanUsers.length === 0) {
    return NextResponse.json({ success: true, message: 'No orphan users found', deleted: 0 });
  }

  const ids = orphanUsers.map(u => u.id);

  await db.notification.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({
    success: true,
    deleted: ids.length,
    users: orphanUsers.map(u => ({ email: u.email, name: u.name, status: u.status })),
  });
}
