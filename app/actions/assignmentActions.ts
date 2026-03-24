"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { notifyStudentsByFilter } from "@/lib/notifications";

export async function createAssignmentAction(data: {
  title: string;
  formUrl: string;
  departmentId: string;
  academicYear: number;
}) {
  try {
    await db.assignment.create({
      data: {
        title: data.title,
        fileUrl: data.formUrl,
        departmentId: data.departmentId,
        academicYear: data.academicYear,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await notifyStudentsByFilter(
      'New Assignment',
      `A new assignment has been published: ${data.title}`,
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
        subject: { select: { name: true, department: { select: { name: true } } } },
      },
    });
  } catch {
    return [];
  }
}

export async function deleteAssignmentAction(id: string) {
  try {
    await db.assignment.delete({ where: { id } });
    revalidatePath('/doctor/assignments');
    return { success: true };
  } catch {
    return { success: false };
  }
}
