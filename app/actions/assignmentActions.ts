"use server";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";
import { revalidatePath } from "next/cache";
import { notifyStudentsByFilter } from "@/lib/notifications";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function createAssignmentAction(data: {
  title: string;
  departmentId: string;
  academicYear: number;
  semester: number;
  subjectId?: string | null;
  startDate: string;
  deadline: string;
  description?: string | null;
  fileUrl?: string | null;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      return { success: false, error: 'Unauthorized' };
    }
    const created = await db.assignment.create({
      data: {
        title: data.title,
        description: data.description || null,
        fileUrl: data.fileUrl || null,
        departmentId: data.departmentId,
        academicYear: data.academicYear,
        semester: data.semester,
        subjectId: data.subjectId || null,
        deadline: new Date(data.deadline),
        allowUpload: true,
      },
    });

    // Set startDate via raw SQL since it was added directly to DB
    if (data.startDate) {
      await db.$executeRaw`
        UPDATE assignments SET "startDate" = ${new Date(data.startDate)} WHERE id = ${created.id}
      `;
    }

    let subjectName = '';
    if (data.subjectId) {
      const subj = await db.subject.findUnique({ where: { id: data.subjectId }, select: { name: true } });
      if (subj?.name) subjectName = ` (${subj.name})`;
    }

    await notifyStudentsByFilter(
      `📝 New Assignment${subjectName}`,
      `A new assignment has been published: ${data.title}${subjectName}. Please submit your work before the deadline.`,
      'ASSIGNMENT',
      data.departmentId,
      data.academicYear
    );

    cache.invalidatePattern('student:assignments');
    cache.delete('doctor:stats:summary');
    revalidatePath('/doctor/assignments');
    return { success: true };
  } catch (error) {
    console.error('Assignment create error:', error);
    return { success: false, error: 'Failed to save assignment' };
  }
}

export async function getAssignmentsAction() {
  try {
    const assignments = await db.assignment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { submissions: true } },
      },
    });

    // Get department names for assignments that have departmentId
    const deptIds = Array.from(new Set(assignments.map(a => a.departmentId).filter((id): id is string => id !== null)));
    const departments = deptIds.length > 0
      ? await db.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
      : [];
    const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));

    return assignments.map(a => ({
      ...a,
      department: a.departmentId ? { name: deptMap[a.departmentId] ?? '' } : null,
    }));
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
    cache.invalidatePattern('student:assignments');
    cache.delete('doctor:stats:summary');
    revalidatePath('/doctor/assignments');
    return { success: true };
  } catch {
    return { success: false };
  }
}
