export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

function isAdminRole(role?: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

// Migrate all semester=1 records to semester=2 in assignments and attendance_sessions
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Assignments
    const assignments = await db.$executeRaw`
      UPDATE assignments SET semester = 2 WHERE semester = 1
    `;

    // 2. Attendance sessions
    const attendance = await db.$executeRaw`
      UPDATE attendance_sessions SET "semester" = 2 WHERE "semester" = 1
    `;

    // 3. Students
    const students = await db.$executeRaw`
      UPDATE students SET semester = 2 WHERE semester = 1
    `;

    // Verify
    const assignmentCheck = await db.$queryRaw<{ semester: number; count: number }[]>`
      SELECT semester, COUNT(*)::int as count FROM assignments GROUP BY semester ORDER BY semester
    `;
    const attendanceCheck = await db.$queryRaw<{ semester: number; count: number }[]>`
      SELECT "semester", COUNT(*)::int as count FROM attendance_sessions GROUP BY "semester" ORDER BY "semester"
    `;

    return NextResponse.json({
      success: true,
      updated: { assignments: Number(assignments), attendance: Number(attendance), students: Number(students) },
      verify: { assignments: assignmentCheck, attendance: attendanceCheck },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
