import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - preview duplicates and find who has code 26024
export async function GET() {
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
export async function POST() {
  // Fix ALL non-active students that have duplicate codes with any other student
  const result = await db.$executeRaw`
    UPDATE students
    SET "studentCode" = CONCAT('DUP_', id)
    WHERE id IN (
      SELECT s1.id
      FROM students s1
      JOIN users u1 ON u1.id = s1."userId"
      WHERE u1.status != 'ACTIVE'
        AND EXISTS (
          SELECT 1 FROM students s2
          WHERE s2."studentCode" = s1."studentCode"
            AND s2.id != s1.id
        )
    )
  `;
  return NextResponse.json({ success: true, updated: Number(result) });
}
