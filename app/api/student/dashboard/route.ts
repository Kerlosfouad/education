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

    // Get student's semester
    const semesterRows = await db.$queryRaw<{semester: number}[]>`SELECT semester FROM students WHERE id = ${student.id}`;
    const semester = semesterRows[0]?.semester ?? null;

    // Get subject IDs for student's dept+year+semester
    const subjectWhere: any = { departmentId: student.departmentId, academicYear: student.academicYear };
    if (semester) subjectWhere.semester = semester;
    const studentSubjects = await db.subject.findMany({ where: subjectWhere, select: { id: true } });
    const subjectIds = studentSubjects.map(s => s.id);

    // Quizzes available - filtered by student's department, year and semester
    const quizzes = await db.quiz.findMany({
      where: {
        isPublished: true,
        departmentId: student.departmentId,
        academicYear: student.academicYear,
        OR: [{ subjectId: null }, { subjectId: { in: subjectIds } }],
      },
      include: { subject: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Assignments - filtered by student's department, year and semester
    const assignments = await db.assignment.findMany({
      where: {
        isActive: true,
        departmentId: student.departmentId,
        academicYear: student.academicYear,
        OR: [{ subjectId: null, semester: semester ?? undefined }, { subjectId: { in: subjectIds } }],
      },
      include: { subject: { select: { name: true } } },
      orderBy: { deadline: 'asc' },
      take: 5,
    });

    // Attendance rate - based on closed sessions for student's department AND academicYear AND semester
    const totalSessionsRaw = await db.$queryRaw<{count: bigint}[]>`
      SELECT COUNT(*) as count FROM attendance_sessions
      WHERE "closeTime" < ${now}
      AND ("departmentId" IS NULL OR "departmentId" = ${student.departmentId})
      AND ("academicYear" IS NULL OR "academicYear" = ${student.academicYear})
      AND ("semester" IS NULL OR "semester" = ${semester})
    `;
    const totalSessions = Number(totalSessionsRaw[0]?.count ?? 0);
    const attendedSessions = await db.attendance.count({
      where: { studentId: student.id, verificationMethod: { not: 'ABSENT' } },
    });
    const attendanceRate = totalSessions > 0
      ? Math.round((attendedSessions / totalSessions) * 100)
      : 0;

    // Auto-mark absent for sessions that have closed and student has no record
    const closedSessions = await db.$queryRaw<{id: string}[]>`
      SELECT id FROM attendance_sessions
      WHERE "closeTime" < ${now}
      AND ("departmentId" IS NULL OR "departmentId" = ${student.departmentId})
      AND ("academicYear" IS NULL OR "academicYear" = ${student.academicYear})
      AND ("semester" IS NULL OR "semester" = ${semester})
    `;
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

    // Open attendance session (for auto-popup) - filtered by student's department
    const openSessionRaw = await db.$queryRaw<any[]>`
      SELECT s.id, s.title, s."closeTime",
             subj.name as subject_name
      FROM attendance_sessions s
      LEFT JOIN subjects subj ON s."subjectId" = subj.id
      WHERE s."isOpen" = true
        AND s."openTime" <= ${now}
        AND s."closeTime" >= ${now}
        AND (s."departmentId" IS NULL OR s."departmentId" = ${student.departmentId})
      LIMIT 1
    `;
    const openSession = openSessionRaw[0] ? {
      id: openSessionRaw[0].id,
      title: openSessionRaw[0].title,
      closeTime: openSessionRaw[0].closeTime,
      subject: { name: openSessionRaw[0].subject_name || '' },
    } : null;

    // Check if already marked today
    let alreadyMarked = false;
    if (openSession) {
      const existing = await db.attendance.findFirst({
        where: { studentId: student.id, sessionId: openSession.id },
      });
      alreadyMarked = !!existing;
    }

    // Videos - filtered by student's department, year and semester
    const videos = await db.lectureSlide.findMany({
      where: {
        fileType: 'video',
        OR: [
          { subjectId: null },
          { subject: { departmentId: student.departmentId, academicYear: student.academicYear, ...(semester ? { semester } : {}) } },
        ],
      },
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
      where: { role: 'DOCTOR', doctorProfile: { isNot: null } },
      select: {
        name: true,
        email: true,
        image: true,
        doctorProfile: {
          select: {
            title: true,
            bio: true,
            phone: true,
            whatsapp: true,
            facebook: true,
            instagram: true,
            twitter: true,
          },
        },
      },
    });
    const dp = doctor?.doctorProfile;

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
          name: doctor?.name || '',
          email: doctor?.email || '',
          image: doctor?.image?.startsWith('data:') ? '' : (doctor?.image || ''),
          title: dp?.title || '',
          bio: dp?.bio || '',
          phone: dp?.phone || '',
          whatsapp: dp?.whatsapp || '',
          facebook: dp?.facebook || '',
          instagram: dp?.instagram || '',
          twitter: dp?.twitter || '',
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
