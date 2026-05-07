import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// One-time migration: create student_subjects table
// Safe - only adds new table, no existing data touched
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS student_subjects (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "studentId" TEXT NOT NULL,
        "subjectId" TEXT NOT NULL,
        "enrolledAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT student_subjects_student_fkey
          FOREIGN KEY ("studentId") REFERENCES students(id) ON DELETE CASCADE,
        CONSTRAINT student_subjects_subject_fkey
          FOREIGN KEY ("subjectId") REFERENCES subjects(id) ON DELETE CASCADE,
        CONSTRAINT student_subjects_unique
          UNIQUE ("studentId", "subjectId")
      )
    `;

    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS student_subjects_student_idx ON student_subjects("studentId")
    `;
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS student_subjects_subject_idx ON student_subjects("subjectId")
    `;

    // Verify table exists
    const check = await db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int as count FROM information_schema.tables 
      WHERE table_name = 'student_subjects'
    `;

    return NextResponse.json({ success: true, tableExists: check[0]?.count > 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
