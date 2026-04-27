import { db } from './db';

type NotifType = 'QUIZ' | 'ASSIGNMENT' | 'ATTENDANCE' | 'ANNOUNCEMENT' | 'EXAM_RESULT' | 'GENERAL';

/**
 * Send a notification to all active students
 */
export async function notifyAllStudents(
  title: string,
  message: string,
  type: NotifType = 'GENERAL'
) {
  try {
    const students = await db.user.findMany({
      where: { role: 'STUDENT', status: 'ACTIVE' },
      select: { id: true },
    });

    if (students.length === 0) return;

    await db.notification.createMany({
      data: students.map(s => ({
        userId: s.id,
        title,
        message,
        type,
      })),
    });
  } catch (error) {
    console.error('Failed to send notifications:', error);
  }
}

/**
 * Send a notification only to students matching a specific department and academic year
 */
export async function notifyStudentsByFilter(
  title: string,
  message: string,
  type: NotifType,
  departmentId: string,
  academicYear: number
) {
  try {
    const students = await db.student.findMany({
      where: {
        departmentId,
        academicYear,
        user: { status: 'ACTIVE' },
      },
      select: { userId: true },
    });

    if (students.length === 0) return;

    await db.notification.createMany({
      data: students.map(s => ({
        userId: s.userId,
        title,
        message,
        type,
      })),
    });
  } catch (error) {
    console.error('Failed to send filtered notifications:', error);
  }
}
