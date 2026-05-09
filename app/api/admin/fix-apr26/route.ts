import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const depts = await db.department.findMany({ select: { id: true, name: true, code: true } });

  const sessions = await db.$queryRaw<any[]>`
    SELECT s.id, s.title, s."openTime", s."departmentId", s."academicYear",
           d.name as dept_name,
           (SELECT COUNT(*) FROM attendances a WHERE a."sessionId" = s.id) as attendance_count
    FROM attendance_sessions s
    LEFT JOIN departments d ON d.id = s."departmentId"
    ORDER BY s."openTime" DESC
    LIMIT 30
  `;

  return NextResponse.json({ depts, sessions, total: sessions.length });
}

export async function POST() {
  const targetDepts = await db.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM departments WHERE code IN ('ARCH', 'CIVIL')
  `;

  if (targetDepts.length === 0) {
    return NextResponse.json({ error: 'Architecture/Civil departments not found' });
  }

  const results = [];

  for (const dept of targetDepts) {
    const session = await db.attendanceSession.create({
      data: {
        title: `Lecture - ${dept.name} - Apr 26`,
        openTime: new Date('2026-04-26T08:00:00.000Z'),
        closeTime: new Date('2026-04-26T23:59:00.000Z'),
        isOpen: false,
        createdBy: 'admin',
      },
    });

    await db.$executeRaw`
      UPDATE attendance_sessions 
      SET "departmentId" = ${dept.id}, "academicYear" = 2
      WHERE id = ${session.id}
    `;

    const students = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM students WHERE "departmentId" = ${dept.id} AND "academicYear" = 2
    `;

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
