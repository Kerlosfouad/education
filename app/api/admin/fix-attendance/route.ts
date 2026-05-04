import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// One-time fix: swap ABSENT <-> PRESENT for Computer Engineering Year 1 Semester 2
// Protected by secret key - DELETE THIS FILE AFTER USE
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dept = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM departments 
      WHERE code = 'CE' OR name ILIKE '%computer%engineer%' 
      LIMIT 1
    `;
    if (!dept[0]) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    const deptId = dept[0].id;

    // Step 0: migrate sessions from semester 1 -> 2
    const migrated = await db.$executeRaw`
      UPDATE attendance_sessions
      SET "semester" = 2
      WHERE "departmentId" = ${deptId}
        AND "academicYear" = 1
        AND "semester" = 1
    `;

    // Preview before swap
    const before = await db.$queryRaw<{ method: string; count: number }[]>`
      SELECT a."verificationMethod" as method, COUNT(*)::int as count
      FROM attendances a
      JOIN attendance_sessions sess ON a."sessionId" = sess.id
      WHERE sess."departmentId" = ${deptId}
        AND sess."academicYear" = 1
        AND sess."semester" = 2
      GROUP BY a."verificationMethod"
    `;

    // Step 1: present -> TEMP
    await db.$executeRaw`
      UPDATE attendances SET "verificationMethod" = 'TEMP_PRESENT'
      WHERE "sessionId" IN (
        SELECT id FROM attendance_sessions 
        WHERE "departmentId" = ${deptId} AND "academicYear" = 1 AND "semester" = 2
      )
      AND "verificationMethod" != 'ABSENT'
    `;

    // Step 2: ABSENT -> QR_CODE (present)
    await db.$executeRaw`
      UPDATE attendances SET "verificationMethod" = 'QR_CODE'
      WHERE "sessionId" IN (
        SELECT id FROM attendance_sessions 
        WHERE "departmentId" = ${deptId} AND "academicYear" = 1 AND "semester" = 2
      )
      AND "verificationMethod" = 'ABSENT'
    `;

    // Step 3: TEMP -> ABSENT
    await db.$executeRaw`
      UPDATE attendances SET "verificationMethod" = 'ABSENT'
      WHERE "sessionId" IN (
        SELECT id FROM attendance_sessions 
        WHERE "departmentId" = ${deptId} AND "academicYear" = 1 AND "semester" = 2
      )
      AND "verificationMethod" = 'TEMP_PRESENT'
    `;

    // Preview after
    const after = await db.$queryRaw<{ method: string; count: number }[]>`
      SELECT a."verificationMethod" as method, COUNT(*)::int as count
      FROM attendances a
      JOIN attendance_sessions sess ON a."sessionId" = sess.id
      WHERE sess."departmentId" = ${deptId}
        AND sess."academicYear" = 1
        AND sess."semester" = 2
      GROUP BY a."verificationMethod"
    `;

    return NextResponse.json({ success: true, migratedSessions: migrated, before, after });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
