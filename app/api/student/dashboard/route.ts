import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentBase = await getOrCreateStudent(session.user.id);
    if (!studentBase) return NextResponse.json({ error: 'No department found' }, { status: 404 });

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      include: { user: true, department: true },
    });

    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const now = new Date();

    // Quizzes available - filtered by student's department and year
    const quizzes = await db.quiz.findMany({
      where: {
        isPublished: true,
        departmentId: student.departmentId,
        academicYear: student.academicYear,
      },
      include: { subject: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Assignments - filtered by student's department and year
    const assignments = await db.assignment.findMany({
      where: {
        isActive: true,
        departmentId: student.departmentId,
        academicYear: student.academicYear,
      },
      include: { subject: { select: { name: true } } },
      orderBy: { deadline: 'asc' },
      take: 5,
    });

    // Attendance rate - based on closed sessions only
    const totalSessions = await db.attendanceSession.count({
      where: { closeTime: { lt: now } },
    });
    const attendedSessions = await db.attendance.count({
      where: { studentId: student.id, verificationMethod: { not: 'ABSENT' } },
    });
    const attendanceRate = totalSessions > 0
      ? Math.round((attendedSessions / totalSessions) * 100)
      : 0;

    // Auto-mark absent for sessions that have closed and student has no record
    const closedSessions = await db.attendanceSession.findMany({
      where: { closeTime: { lt: now } },
      select: { id: true },
    });
    if (closedSessions.length > 0) {
      const closedIds = closedSessions.map((s) => s.id);
      const existingRecords = await db.attendance.findMany({
        where: { studentId: student.id, sessionId: { in: closedIds } },
        select: { sessionId: true },
      });
      const existingSessionIds = new Set(existingRecords.map((r) => r.sessionId));
      const missedIds = closedIds.filter((id) => !existingSessionIds.has(id));
      if (missedIds.length > 0) {
        await db.attendance.createMany({
          data: missedIds.map((sessionId) => ({
            studentId: student.id,
            sessionId,
            verificationMethod: 'ABSENT',
          })),
          skipDuplicates: true,
        });
      }
    }

    // Open attendance session (for auto-popup)
    const openSession = await db.attendanceSession.findFirst({
      where: { isOpen: true, openTime: { lte: now }, closeTime: { gte: now } },
      include: { subject: { select: { name: true } } },
    });

    // Check if already marked today
    let alreadyMarked = false;
    if (openSession) {
      const existing = await db.attendance.findFirst({
        where: { studentId: student.id, sessionId: openSession.id },
      });
      alreadyMarked = !!existing;
    }

    // Videos
    const videos = await db.lectureSlide.findMany({
      where: { fileType: 'video' },
      include: { subject: { select: { name: true } } },
      orderBy: { uploadedAt: 'desc' },
      take: 5,
    });

    // Live sessions
    const liveSessions = await db.zoomLecture.findMany({
      where: { scheduledAt: { gte: now } },
      include: { subject: { select: { name: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });

    // Library - fetch from Book model (same as doctor uploads)
    const libraryItems = await db.book.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Unread notifications count
    const unreadCount = await db.notification.count({
      where: { userId: session.user.id, isRead: false },
    });

    // Doctor info (for student dashboard display)
    const doctor = await db.user.findFirst({
      where: { role: 'DOCTOR' },
      select: { name: true, email: true, image: true },
    });
    const doctorProfiles = await db.$queryRaw<any[]>`
      SELECT title, bio, phone, whatsapp, facebook, instagram, twitter
      FROM doctor_profiles LIMIT 1
    `;
    const dp = doctorProfiles[0] || {};

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.user.name,
          email: student.user.email,
          studentCode: student.studentCode,
          department: student.department.name,
          academicYear: student.academicYear,
        },
        doctor: {
          name: doctor?.name || 'EDUBRIDGE',
          email: doctor?.email || '',
          image: doctor?.image || '',
          title: dp.title || '',
          bio: dp.bio || '',
          phone: dp.phone || '',
          whatsapp: dp.whatsapp || '',
          facebook: dp.facebook || '',
          instagram: dp.instagram || '',
          twitter: dp.twitter || '',
        },
        stats: {
          quizzesCount: quizzes.length,
          assignmentsCount: assignments.length,
          attendanceRate,
          videosCount: videos.length,
        },
        quizzes,
        assignments,
        videos,
        liveSessions,
        libraryItems: libraryItems.map(b => ({
          id: b.id,
          title: b.name,
          author: null,
          fileUrl: b.url,
          externalUrl: null,
          subject: null,
        })),
        openSession: openSession && !alreadyMarked ? openSession : null,
        alreadyMarked,
        unreadCount,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
