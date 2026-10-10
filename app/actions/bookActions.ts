'use server'

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { notifyAllStudents, notifyStudentsByFilter } from "@/lib/notifications";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cache } from "@/lib/cache";

// Fetch books from database
export async function getBooksAction() {
  try {
    return await db.book.findMany({
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

export async function deleteBookAction(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      return { success: false };
    }
    await db.book.delete({
      where: { id }
    });
    cache.invalidatePattern('library:');
    cache.invalidateTag('books');
    revalidatePath("/doctor/libbooks");
    return { success: true };
  } catch (error) {
    console.error("Delete Error:", error);
    return { success: false };
  }
}

// Save a new book
export async function saveBookAction(data: { name: string, type: string, size: string, url: string, departmentId?: string, academicYear?: number }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role)) {
      throw new Error('Unauthorized');
    }
    if (!data.url) {
      throw new Error('File URL is required');
    }

    const book = await db.book.create({
      data: {
        name: data.name,
        type: data.type || 'PDF',
        size: data.size || '0 MB',
        url: data.url,
        ...(data.departmentId ? { departmentId: data.departmentId } : {}),
        ...(data.academicYear !== undefined && data.academicYear !== null ? { academicYear: data.academicYear } : {}),
      },
    });

    // Invalidate library and books caches immediately
    cache.invalidatePattern('library:');
    cache.invalidateTag('books');

    // Notify students without blocking book creation on error
    try {
      if (data.departmentId && data.academicYear !== undefined && data.academicYear !== null) {
        await notifyStudentsByFilter('📚 New library item', `"${data.name}" was added to the E-Library`, 'ANNOUNCEMENT', data.departmentId, data.academicYear);
      } else if (data.departmentId) {
        const deptStudents = await db.student.findMany({ where: { departmentId: data.departmentId, user: { status: 'ACTIVE' } }, select: { userId: true } });
        if (deptStudents.length > 0) {
          await db.notification.createMany({ data: deptStudents.map(s => ({ userId: s.userId, title: '📚 New library item', message: `"${data.name}" was added to the E-Library`, type: 'ANNOUNCEMENT' as const })) });
        }
      } else {
        await notifyAllStudents('📚 New library item', `"${data.name}" was added to the E-Library`, 'ANNOUNCEMENT');
      }
    } catch (notifErr) {
      console.warn("Could not send library notifications:", notifErr);
    }

    revalidatePath("/doctor/libbooks");
    return book;
  } catch (error: any) {
    console.error("Database Error:", error);
    throw new Error(error?.message || "Failed to save book");
  }
}
