import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent } from '@/lib/db';
import { UAParser } from 'ua-parser-js';

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
          _count: {
            select: {
              attendances: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return NextResponse.json({ success: true, data: sessions });
    }

    // For students, get their own attendance
    if (session.user.role === 'STUDENT') {
      const student = await getOrCreateStudent(session.user.id);
      if (!student) return NextResponse.json({ error: 'No department found' }, { status: 404 });

      const attendances = await db.attendance.findMany({
        where: { studentId: student.id },
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
      const { subjectId, title, openTime, closeTime } = body;

      if (!subjectId || !openTime || !closeTime) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const attendanceSession = await db.attendanceSession.create({
        data: {
          subjectId,
          title,
          openTime: new Date(openTime),
          closeTime: new Date(closeTime),
          createdBy: session.user.id,
        },
        include: {
          subject: true,
        },
      });

      return NextResponse.json(
        { success: true, data: attendanceSession },
        { status: 201 }
      );
    }

    // Student marking attendance
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
