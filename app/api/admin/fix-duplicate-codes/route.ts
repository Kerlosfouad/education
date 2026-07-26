export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

function isAdminRole(role?: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

// GET - preview duplicates and find who has code 26024
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const duplicates = await db.$queryRaw<{ id: string; studentCode: string; status: string; name: string }[]>`
    SELECT s.id, s."studentCode", u.status, u.name
    FROM students s
    JOIN users u ON u.id = s."userId"
    WHERE u.status != 'ACTIVE'
      AND s."studentCode" IN (
        SELECT s2."studentCode"
        FROM students s2
        JOIN users u2 ON u2.id = s2."userId"
        WHERE u2.status = 'ACTIVE'
      )
    ORDER BY s."studentCode"
  `;

  // Find all students with code 26024
  const code26024 = await db.$queryRaw<{ id: string; studentCode: string; status: string; name: string; userId: string }[]>`
    SELECT s.id, s."studentCode", u.status, u.name, u.id as "userId"
    FROM students s
    JOIN users u ON u.id = s."userId"
    WHERE s."studentCode" = '26024'
  `;

  return NextResponse.json({ duplicates, count: duplicates.length, code26024 });
}

// POST - fix duplicates by clearing codes for non-active students
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Direct fix using known student ID
  const directFix = await db.$executeRaw`
    UPDATE students
    SET "studentCode" = CONCAT('DUP_', SUBSTRING(id, 1, 8))
    WHERE id = 'cmorpugzb0002nobi0lx6k9gr'
  `;

  // Also fix any other non-active duplicates
  const generalFix = await db.$executeRaw`
    UPDATE students s
    SET "studentCode" = CONCAT('DUP_', SUBSTRING(s.id, 1, 8))
    FROM users u
    WHERE u.id = s."userId"
      AND u.status IN ('REJECTED', 'PENDING', 'SUSPENDED')
      AND EXISTS (
        SELECT 1 FROM students s2
        WHERE s2."studentCode" = s."studentCode"
          AND s2.id != s.id
      )
  `;

  return NextResponse.json({ success: true, directFix: Number(directFix), generalFix: Number(generalFix) });
}
