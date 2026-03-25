import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { student: { include: { department: true } } },
    });

    if (!user?.student) return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });

    const student = user.student;

    const doctor = await db.user.findFirst({
      where: { role: 'DOCTOR' },
      include: { doctorProfile: true },
    });

    const [quizzes, assignments, videos, liveSessions, libraryItems, attendances, openSession] = await Promise.all([
      db.quiz.findMany({ where: { isPublished: true, AND: [{ OR: [{ departmentId: student.departmentId }, { departmentId: null }] }, { OR: [{ academicYear: student.academicYear }, { academicYear: null }] }] }, include: { subject: { select: { name: true } }, _count: { select: { questions: true } } }, take: 5 }),
      db.assignment.findMany({ where: { OR: [{ departmentId: student.departmentId }, { departmentId: null }] }, include: { subject: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }),
      db.lectureSlide.findMany({ orderBy: { uploadedAt: 'desc' }, take: 5, include: { subject: { select: { name: true } } } }),
      db.zoomLecture.findMany({ where: { scheduledAt: { gte: new Date() } }, include: { subject: { select: { name: true } } }, orderBy: { scheduledAt: 'asc' }, take: 5 }),
      db.eLibraryItem.findMany({ where: { isActive: true }, take: 6 }),
      db.attendance.count({ where: { studentId: student.id } }),
      db.attendanceSession.findFirst({ where: { isOpen: true } }),
    ]);

    const alreadyMarked = openSession ? !!(await db.attendance.findFirst({ where: { studentId: student.id, sessionId: openSession.id } })) : false;
    const totalSessions = await db.attendanceSession.count();
    const attendanceRate = totalSessions > 0 ? Math.round((attendances / totalSessions) * 100) : 0;

    const unreadCount = await db.notification.count({ where: { userId: user.id, isRead: false } });

    return NextResponse.json({
      success: true,
      data: {
        student: { id: student.id, name: user.name, email: user.email, studentCode: student.studentCode, department: student.department.name, academicYear: student.academicYear },
        doctor: doctor ? { name: doctor.name, email: doctor.email, image: doctor.image, title: doctor.doctorProfile?.title, bio: doctor.doctorProfile?.bio, phone: doctor.doctorProfile?.phone, whatsapp: doctor.doctorProfile?.whatsapp, facebook: doctor.doctorProfile?.facebook, instagram: doctor.doctorProfile?.instagram, twitter: doctor.doctorProfile?.twitter } : null,
        stats: { quizzesCount: quizzes.length, assignmentsCount: assignments.length, attendanceRate, videosCount: videos.length },
        quizzes, assignments, videos, liveSessions, libraryItems,
        openSession: openSession ? { id: openSession.id, title: openSession.title, subject: { name: 'Lecture' } } : null,
        alreadyMarked, unreadCount,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
