export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent, getStudentSubjectAccess } from '@/lib/db';
import { cache } from '@/lib/cache';

/**
 * Lightweight, high-performance endpoint specifically designed for polling/checking
 * active attendance sessions without loading the entire heavy dashboard.
 * 
 * Results of open session lookup are cached for 15 seconds across students in the same department/year,
 * saving hundreds of database queries when an entire lecture polls simultaneously.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await getOrCreateStudent(session.user.id);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const { semester, subjectIds } = await getStudentSubjectAccess(student);
    const now = new Date();

    // Cache the open session search per department/year/semester for 15 seconds
    const cacheKey = `active-session:${student.departmentId}:${student.academicYear}:${semester}`;
    const openSession = await cache.remember(
      cacheKey,
      15, // 15 seconds TTL
      async () => {
        const openSessionRaw = await db.$queryRaw<any[]>`
          SELECT s.id, s.title, s."closeTime",
                 subj.name as subject_name
          FROM attendance_sessions s
          LEFT JOIN subjects subj ON s."subjectId" = subj.id
          WHERE s."isOpen" = true
            AND s."openTime" <= (${now}::timestamp + interval '10 minutes')
            AND s."closeTime" >= (${now}::timestamp - interval '15 minutes')
            AND (
              (s."subjectId" IS NOT NULL AND s."subjectId" = ANY(${subjectIds}::text[]))
              OR (
                s."subjectId" IS NULL
                AND (s."departmentId" IS NULL OR s."departmentId" = ${student.departmentId})
                AND (s."academicYear" IS NULL OR s."academicYear" = ${student.academicYear})
                AND (s."semester" IS NULL OR s."semester" = ${semester})
              )
            )
          ORDER BY s."createdAt" DESC
          LIMIT 1
        `;

        if (!openSessionRaw || openSessionRaw.length === 0) return null;

        return {
          id: openSessionRaw[0].id,
          title: openSessionRaw[0].title,
          closeTime: openSessionRaw[0].closeTime,
          subject: { name: openSessionRaw[0].subject_name || '' },
        };
      },
      [`attendance:open`]
    );

    let alreadyMarked = false;
    if (openSession?.id) {
      const existing = await db.attendance.findFirst({
        where: { studentId: student.id, sessionId: openSession.id },
        select: { id: true, verificationMethod: true },
      });
      alreadyMarked = !!existing && existing.verificationMethod !== 'ABSENT';
    }

    return NextResponse.json({
      success: true,
      data: {
        openSession,
        alreadyMarked,
      },
    });
  } catch (error) {
    console.error('Error fetching active attendance session:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
