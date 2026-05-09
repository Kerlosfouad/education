import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  // Step 1: Find departments
  const depts = await db.department.findMany({ select: { id: true, name: true, code: true } });
  
  // Step 2: Find sessions on April 26 for level 2
  const sessions = await db.$queryRaw<any[]>`
    SELECT s.id, s.title, s."openTime", s."departmentId", s."academicYear"
    FROM attendance_sessions s
    WHERE s."academicYear" = 2
      AND DATE(s."openTime") = '2026-04-26'
  `;

  return NextResponse.json({ depts, sessions });
}

export async function POST() {
  // Find Architecture and Civil departments
  const targetDepts = await db.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM departments 
    WHERE name ILIKE '%architecture%' OR name ILIKE '%civil%' 
       OR name ILIKE '%عمار%' OR name ILIKE '%مدن%'
       OR code ILIKE '%arch%' OR code ILIKE '%civil%'
  `;

  if (targetDepts.length === 0) {
    return NextResponse.json({ error: 'No matching departments found', hint: 'Check GET for all departments' });
  }

  const deptIds = targetDepts.map(d => d.id);

  // Find sessions on April 26 for these depts at level 2
  const sessions = await db.$queryRaw<{ id: string; title: string }[]>`
    SELECT id, title FROM attendance_sessions
    WHERE "academicYear" = 2
      AND DATE("openTime") = '2026-04-26'
      AND "departmentId" = ANY(${deptIds}::text[])
  `;

  if (sessions.length === 0) {
    return NextResponse.json({ error: 'No sessions found on 2026-04-26 for these departments at level 2', departments: targetDepts });
  }

  const sessionIds = sessions.map(s => s.id);

  // Get all students in these depts at level 2
  const students = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM students
    WHERE "departmentId" = ANY(${deptIds}::text[])
      AND "academicYear" = 2
  `;

  let fixed = 0;
  for (const session of sessions) {
    for (const student of students) {
      // Delete ABSENT record if exists
      await db.$executeRaw`
        DELETE FROM attendances 
        WHERE "studentId" = ${student.id} AND "sessionId" = ${session.id} AND "verificationMethod" = 'ABSENT'
      `;
      // Insert PRESENT if not exists
      const existing = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM attendances WHERE "studentId" = ${student.id} AND "sessionId" = ${session.id}
      `;
      if (existing.length === 0) {
        await db.$executeRaw`
          INSERT INTO attendances (id, "studentId", "sessionId", "verificationMethod", timestamp)
          VALUES (gen_random_uuid()::text, ${student.id}, ${session.id}, 'MANUAL', NOW())
        `;
        fixed++;
      }
    }
  }

  return NextResponse.json({ 
    success: true, 
    departments: targetDepts,
    sessions,
    studentsCount: students.length,
    recordsFixed: fixed
  });
}
