"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { notifyStudentsByFilter } from "@/lib/notifications";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function createAssignmentAction(data: {
  title: string;
  departmentId: string;
  academicYear: number;
  semester: number;
  durationDays: number;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      return { success: false, error: 'Unauthorized' };
    }
    await db.assignment.create({
      data: {
        title: data.title,
        departmentId: data.departmentId,
        academicYear: data.academicYear,
        semester: data.semester,
        deadline: new Date(Date.now() + data.durationDays * 24 * 60 * 60 * 1000),
        allowUpload: true,
      },
    });

    await notifyStudentsByFilter(
      '📝 New Assignment',
      `A new assignment has been published: ${data.title}. Please submit your PDF before the deadline.`,
      'ASSIGNMENT',
      data.departmentId,
      data.academicYear
    );

    revalidatePath('/doctor/assignments');
    return { success: true };
  } catch (error) {
    console.error('Assignment create error:', error);
    return { success: false, error: 'Failed to save assignment' };
  }
}

export async function getAssignmentsAction() {
  try {
    return await db.assignment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { submissions: true } },
      },
    });
  } catch {
    return [];
  }
}

export async function deleteAssignmentAction(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      return { success: false };
    }
    await db.assignment.delete({ where: { id } });
    revalidatePath('/doctor/assignments');
    return { success: true };
  } catch {
    return { success: false };
  }
}
