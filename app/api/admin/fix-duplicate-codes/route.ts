import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - preview duplicates
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
  return NextResponse.json({ duplicates, count: duplicates.length });
}

// POST - fix duplicates by clearing codes for non-active students
export async function POST() {
  const result = await db.$executeRaw`
    UPDATE students
    SET "studentCode" = CONCAT('DUP_', id)
    WHERE id IN (
      SELECT s.id
      FROM students s
      JOIN users u ON u.id = s."userId"
      WHERE u.status != 'ACTIVE'
        AND s."studentCode" IN (
          SELECT s2."studentCode"
          FROM students s2
          JOIN users u2 ON u2.id = s2."userId"
          WHERE u2.status = 'ACTIVE'
        )
    )
  `;
  return NextResponse.json({ success: true, updated: Number(result) });
}
