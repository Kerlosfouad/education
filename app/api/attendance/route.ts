import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent } from '@/lib/db';
import { UAParser } from 'ua-parser-js';
import { notifyAllStudents, notifyStudentsByFilter } from '@/lib/notifications';

// GET /api/attendance - Get attendance sessions or records
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');
    const sessionId = searchParams.get('sessionId');
    const studentId = searchParams.get('studentId');

    // If sessionId is provided, get attendance records for that session
    if (sessionId) {
      // Check permissions
      if (session.user.role === 'STUDENT') {
        const student = await db.student.findUnique({
          where: { userId: session.user.id },
        });
        if (!student) {
          return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }
      }

      const attendances = await db.attendance.findMany({
        where: { sessionId },
        include: {
          student: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      return NextResponse.json({ success: true, data: attendances });
    }

    // Get attendance sessions
    if (session.user.role === 'DOCTOR' || session.user.role === 'ADMIN') {
      const where: any = {};
      if (subjectId) where.subjectId = subjectId;

      const sessions = await db.attendanceSession.findMany({
        where,
        include: {
          subject: true,
          _count: { select: { attendances: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Fetch departmentId and academicYear via raw SQL (stored outside Prisma schema)
      const sessionIds = sessions.map((s: any) => s.id);
      const rawSessions = sessionIds.length > 0
        ? await db.$queryRaw<{ id: string; departmentId: string | null; academicYear: number | null; semester: number | null }[]>`
            SELECT id, "departmentId", "academicYear", "semester" FROM attendance_sessions WHERE id = ANY(${sessionIds}::text[])
          `
        : [];
      const rawMap = Object.fromEntries(rawSessions.map(r => [r.id, r]));

      // Fetch department info
      const departmentIds = Array.from(new Set(rawSessions.map(r => r.departmentId).filter(Boolean)));
      const departments = departmentIds.length > 0
        ? await db.department.findMany({ where: { id: { in: departmentIds as string[] } }, select: { id: true, name: true, nameAr: true } })
        : [];
      const deptMap = Object.fromEntries(departments.map((d: any) => [d.id, d]));

      const sessionsWithDept = sessions.map((s: any) => {
        const raw = rawMap[s.id];
        return {
          ...s,
          departmentId: raw?.departmentId ?? null,
          academicYear: raw?.academicYear ?? null,
          semester: raw?.semester ?? null,
          department: raw?.departmentId ? deptMap[raw.departmentId] ?? null : null,
        };
      });

      return NextResponse.json({ success: true, data: sessionsWithDept });
    }

    // For students, get their own attendance
    if (session.user.role === 'STUDENT') {
      const student = await getOrCreateStudent(session.user.id);
      if (!student) return NextResponse.json({ error: 'No department found' }, { status: 404 });

      // Get sessions that match student's department and academicYear (or have no filter)
      const allSessions = await db.$queryRaw<any[]>`
        SELECT s.id FROM attendance_sessions s
        WHERE (s."departmentId" IS NULL OR s."departmentId" = ${student.departmentId})
        AND (s."academicYear" IS NULL OR s."academicYear" = ${student.academicYear})
      `;
      const sessionIds = allSessions.map((s: any) => s.id);

      const attendances = await db.attendance.findMany({
        where: { studentId: student.id, sessionId: { in: sessionIds } },
        include: {
          session: {
            include: {
              subject: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      return NextResponse.json({ success: true, data: attendances });
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/attendance - Create attendance session (doctor) or mark attendance (student)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Doctor creating attendance session
    if (session.user.role === 'DOCTOR' || session.user.role === 'ADMIN') {
      const { title, openTime, closeTime, departmentId } = body;

      if (!openTime || !closeTime) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      try {
        const attendanceSession = await db.attendanceSession.create({
          data: {
            subjectId: body.subjectId || null,
            title: title || null,
            openTime: new Date(openTime),
            closeTime: new Date(closeTime),
            createdBy: session.user.id,
          },
        });

        const academicYear = body.academicYear !== undefined && body.academicYear !== '' ? Number(body.academicYear) : null;
        const semester = body.semester !== undefined ? Number(body.semester) : 2;
        if (departmentId || academicYear !== null) {
          await db.$executeRawUnsafe(
            `UPDATE attendance_sessions SET "departmentId" = $1, "academicYear" = $2, "semester" = $3 WHERE id = $4`,
            departmentId || null,
            academicYear,
            semester,
            attendanceSession.id
          );
        }

        // Notify students - filtered by department if provided, else all
        if (departmentId && academicYear) {
          await notifyStudentsByFilter(
            '📋 New Attendance Session',
            `A new attendance session "${title || 'Attendance'}" is now open. Please mark your attendance.`,
            'ATTENDANCE', departmentId, academicYear
          );
        } else if (departmentId) {
          const deptStudents = await db.student.findMany({
            where: { departmentId, user: { status: 'ACTIVE' } },
            select: { userId: true },
          });
          if (deptStudents.length > 0) {
            await db.notification.createMany({
              data: deptStudents.map(s => ({
                userId: s.userId,
                title: '📋 New Attendance Session',
                message: `A new attendance session "${title || 'Attendance'}" is now open. Please mark your attendance.`,
                type: 'ATTENDANCE' as const,
              })),
            });
          }
        } else {
          notifyAllStudents(
            '📋 New Attendance Session',
            `A new attendance session "${title || 'Attendance'}" is now open. Please mark your attendance.`,
            'ATTENDANCE'
          ).catch(() => {});
        }

        return NextResponse.json(
          { success: true, data: attendanceSession },
          { status: 201 }
        );
      } catch (createError: any) {
        console.error('Attendance create error:', createError);
        return NextResponse.json(
          { error: createError?.message || 'Failed to create session' },
          { status: 500 }
        );
      }
    }
    if (session.user.role === 'STUDENT') {
      const { sessionId } = body;

      if (!sessionId) {
        return NextResponse.json(
          { error: 'Missing session ID' },
          { status: 400 }
        );
      }

      const student = await db.student.findUnique({
        where: { userId: session.user.id },
      });

      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      // Check if session is open
      const attendanceSession = await db.attendanceSession.findUnique({
        where: { id: sessionId },
      });

      if (!attendanceSession) {
        return NextResponse.json(
          { error: 'Attendance session not found' },
          { status: 404 }
        );
      }

      // Check session matches student's department and academicYear
      const sessionAny = attendanceSession as any;
      if (sessionAny.departmentId && sessionAny.departmentId !== student.departmentId) {
        return NextResponse.json({ error: 'This session is not for your department' }, { status: 403 });
      }
      if (sessionAny.academicYear !== null && sessionAny.academicYear !== undefined && sessionAny.academicYear !== student.academicYear) {
        return NextResponse.json({ error: 'This session is not for your level' }, { status: 403 });
      }

      const now = new Date();
      if (now < attendanceSession.openTime || now > attendanceSession.closeTime) {
        return NextResponse.json(
          { error: 'Attendance session is not open' },
          { status: 400 }
        );
      }

      // Check if already marked
      const existingAttendance = await db.attendance.findFirst({
        where: {
          studentId: student.id,
          sessionId,
        },
      });

      if (existingAttendance) {
        return NextResponse.json(
          { error: 'Attendance already marked' },
          { status: 409 }
        );
      }

      // Get device info
      const userAgent = req.headers.get('user-agent') || '';
      const parser = new UAParser(userAgent);
      const deviceInfo = `${parser.getDevice().vendor || ''} ${parser.getDevice().model || ''} ${parser.getOS().name || ''}`;
      const ipAddress = req.headers.get('x-forwarded-for') || req.ip || '';

      // Create attendance record
      const attendance = await db.attendance.create({
        data: {
          studentId: student.id,
          sessionId,
          deviceInfo: deviceInfo.trim() || 'Unknown',
          ipAddress: ipAddress.toString(),
          userAgent,
        },
        include: {
          session: {
            include: {
              subject: true,
            },
          },
        },
      });

      return NextResponse.json(
        { success: true, data: attendance },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    console.error('Error creating attendance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/attendance - Update attendance session (open/close)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, isOpen } = body;

    if (!sessionId || typeof isOpen !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const updatedSession = await db.attendanceSession.update({
      where: { id: sessionId },
      data: { isOpen },
    });

    return NextResponse.json({ success: true, data: updatedSession });
  } catch (error) {
    console.error('Error updating attendance session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/attendance - Delete an attendance session (doctor/admin)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    await db.attendanceSession.delete({ where: { id: sessionId } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting attendance session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
