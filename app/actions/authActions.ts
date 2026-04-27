'use server';
import { db } from '@/lib/db';

export async function getUserRoleAction(email: string) {
  const user = await db.user.findUnique({
    where: { email },
    select: { role: true },
  });
  return user?.role;
}
