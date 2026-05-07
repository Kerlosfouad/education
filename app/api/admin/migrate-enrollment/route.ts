import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// One-time migration: create student_subjects table AND enrollment_requests table
// Safe - only adds new tables, no existing data touched
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

    // Create enrollment_requests table
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS enrollment_requests (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "studentId" TEXT NOT NULL,
        "subjectId" TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT enrollment_requests_student_fkey
          FOREIGN KEY ("studentId") REFERENCES students(id) ON DELETE CASCADE,
        CONSTRAINT enrollment_requests_subject_fkey
          FOREIGN KEY ("subjectId") REFERENCES subjects(id) ON DELETE CASCADE,
        CONSTRAINT enrollment_requests_unique
          UNIQUE ("studentId", "subjectId")
      )
    `;
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS enrollment_requests_student_idx ON enrollment_requests("studentId")
    `;
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS enrollment_requests_status_idx ON enrollment_requests(status)
    `;

    const check = await db.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name IN ('student_subjects', 'enrollment_requests')
    `;

    return NextResponse.json({ success: true, tables: check.map(r => r.table_name) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
