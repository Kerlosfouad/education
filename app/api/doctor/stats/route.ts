export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { cache } from '@/lib/cache';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await cache.remember(
      'doctor:stats:summary',
      45, // 45 seconds
      async () => {
        const [totalStudents, totalSessions, totalAttendances, totalAssignments] = await Promise.all([
          db.student.count({ where: { user: { status: 'ACTIVE' } } }),
          db.attendanceSession.count(),
          db.attendance.count({ where: { verificationMethod: { not: 'ABSENT' } } }),
          db.assignment.count({ where: { isActive: true } }),
        ]);

        const possible = totalSessions * totalStudents;
        const attendanceRate = possible > 0 ? Math.round((totalAttendances / possible) * 100) : 0;
        return { attendanceRate, totalAssignments };
      },
      ['doctor:stats']
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
