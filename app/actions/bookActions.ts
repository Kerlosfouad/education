'use server'

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { notifyAllStudents } from "@/lib/notifications";

// دالة لجلب الكتب من الداتا بيز
export async function getBooksAction() {
  try {
    return await db.book.findMany({
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

export async function deleteBookAction(id: string) {
  try {
    await db.book.delete({
      where: { id }
    });
    revalidatePath("/doctor/libbooks");
    return { success: true };
  } catch (error) {
    console.error("Delete Error:", error);
    return { success: false };
  }
}

// دالة لحفظ كتاب جديد
export async function saveBookAction(data: { name: string, type: string, size: string, url: string }) {
  try {
    const book = await db.book.create({
      data: {
        name: data.name,
        type: data.type,
        size: data.size,
        url: data.url,
      },
    });
    await notifyAllStudents(
      '📚 كتاب جديد في المكتبة',
      `تمت إضافة "${data.name}" للمكتبة الإلكترونية`,
      'ANNOUNCEMENT'
    );
    revalidatePath("/doctor/libbooks");
    return book;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to save book");
  }
}
