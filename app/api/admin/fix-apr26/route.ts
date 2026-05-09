import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const depts = await db.department.findMany({ select: { id: true, name: true, code: true } });
  
  // Show ALL sessions to find what exists
  const sessions = await db.$queryRaw<any[]>`
    SELECT s.id, s.title, s."openTime", s."departmentId", s."academicYear",
           d.name as dept_name,
           (SELECT COUNT(*) FROM attendances a WHERE a."sessionId" = s.id) as attendance_count,
           (SELECT COUNT(*) FROM attendances a WHERE a."sessionId" = s.id AND a."verificationMethod" = 'ABSENT') as absent_count
    FROM attendance_sessions s
    LEFT JOIN departments d ON d.id = s."departmentId"
    ORDER BY s."openTime" DESC
    LIMIT 30
  `;

  return NextResponse.json({ depts, sessions, total: sessions.length });
}

export async function POST() {
  // Architecture and Civil Engineering dept IDs
  const targetDepts = await db.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM departments 
    WHERE code IN ('ARCH', 'CIVIL')
  `;

  if (targetDepts.length === 0) {
    return NextResponse.json({ error: 'Architecture/Civil departments not found' });
  }

  const results = [];

  for (const dept of targetDepts) {
    // Create attendance session for April 26
    const session = await db.attendanceSession.create({
      data: {
        title: `Lecture - ${dept.name} - Apr 26`,
        openTime: new Date('2026-04-26T08:00:00.000Z'),
        closeTime: new Date('2026-04-26T23:59:00.000Z'),
        isOpen: false,
        createdBy: 'admin',
      },
    });

    // Set departmentId and academicYear via raw SQL
    await db.$executeRaw`
      UPDATE attendance_sessions 
      SET "departmentId" = ${dept.id}, "academicYear" = 2
      WHERE id = ${session.id}
    `;

    // Get all students in this dept at level 2
    const students = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM students
      WHERE "departmentId" = ${dept.id} AND "academicYear" = 2
    `;

    // Insert PRESENT attendance for all students
    let count = 0;
    for (const student of students) {
      await db.$executeRaw`
        INSERT INTO attendances (id, "studentId", "sessionId", "verificationMethod", timestamp)
        VALUES (gen_random_uuid()::text, ${student.id}, ${session.id}, 'MANUAL', '2026-04-26T10:00:00.000Z')
        ON CONFLICT ("studentId", "sessionId") DO NOTHING
      `;
      count++;
    }

    results.push({ dept: dept.name, sessionId: session.id, studentsMarked: count });
  }

  return NextResponse.json({ success: true, results });
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
