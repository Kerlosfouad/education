import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// One-time fix: swap ABSENT <-> PRESENT for Computer Engineering Year 1 Semester 2
// Protected by secret key - DELETE THIS FILE AFTER USE
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Diagnostic: show what's in the DB
  const departments = await db.$queryRaw`SELECT id, name, code FROM departments`;
  const sessions = await db.$queryRaw`
    SELECT id, title, "departmentId", "academicYear", "semester", "openTime"::date as date
    FROM attendance_sessions ORDER BY "openTime" DESC LIMIT 20
  `;
  const attendanceSample = await db.$queryRaw`
    SELECT a."verificationMethod", COUNT(*)::int as count
    FROM attendances a GROUP BY a."verificationMethod"
  `;
  const totalAttendances = await db.$queryRaw`SELECT COUNT(*)::int as total FROM attendances`;
  return NextResponse.json({ departments, sessions, attendanceSample, totalAttendances });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Work directly on the Apr 26 session (the known problematic session)
    // Step 0: fix academicYear from 2 -> 1 AND ensure semester = 2
    const migrated = await db.$executeRaw`
      UPDATE attendance_sessions SET "academicYear" = 1, "semester" = 2
      WHERE "academicYear" = 2
    `;

    // Preview - no swap needed, just confirm
    const before = await db.$queryRaw<{ method: string; count: number }[]>`
      SELECT a."verificationMethod" as method, COUNT(*)::int as count
      FROM attendances a
      JOIN attendance_sessions sess ON a."sessionId" = sess.id
      WHERE sess."academicYear" = 1 AND sess."semester" = 2
      GROUP BY a."verificationMethod"
    `;

    const after = before; // no swap this time

    return NextResponse.json({ success: true, migratedSessions: migrated, before, after });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
