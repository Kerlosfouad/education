export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { cache } from '@/lib/cache';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const notifications = await cache.remember(
      `notifications:${session.user.id}`,
      20, // 20 seconds buffer for fast polling
      async () => {
        return db.notification.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      },
      [`notifications:${session.user.id}`]
    );

    return NextResponse.json({ success: true, data: notifications });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await req.json();

    if (id) {
      // Ensure the notification belongs to the current user
      await db.notification.updateMany({
        where: { id, userId: session.user.id },
        data: { isRead: true },
      });
    } else {
      await db.notification.updateMany({
        where: { userId: session.user.id, isRead: false },
        data: { isRead: true },
      });
    }

    // Invalidate cached notifications for this user immediately
    cache.delete(`notifications:${session.user.id}`);
    cache.delete(`notifications:unread:${session.user.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
