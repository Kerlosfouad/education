import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const db = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prisma = db

/**
 * Get or auto-create a Student record for a given userId.
 * Useful when a user was created without going through the full registration flow.
 */
export async function getOrCreateStudent(userId: string) {
  let student = await db.student.findUnique({ where: { userId } });
  if (student) return student;

  const dept = await db.department.findFirst();
  if (!dept) return null;

  const code = `STU${new Date().getFullYear().toString().slice(-2)}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  student = await db.student.create({
    data: { userId, studentCode: code, departmentId: dept.id, academicYear: 1 },
  });
  return student;
}
