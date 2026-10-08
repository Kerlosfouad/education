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

import { cache } from './cache';

/**
 * Get student record for a given userId. Returns null if not found.
 * Cached in memory for 180 seconds to avoid constant DB queries.
 */
export async function getOrCreateStudent(userId: string) {
  return cache.remember(
    `student:user:${userId}`,
    180,
    async () => {
      const student = await db.student.findUnique({ where: { userId } });
      return student || null;
    },
    [`student:${userId}`]
  );
}

type StudentAccessInput = {
  id: string;
  departmentId: string;
  academicYear: number;
};

export async function getStudentSubjectAccess(student: StudentAccessInput) {
  const cacheKey = `student:access:${student.id}:${student.departmentId}:${student.academicYear}`;
  return cache.remember(
    cacheKey,
    180,
    async () => {
      const semesterRows = await db.$queryRaw<{ semester: number | null }[]>`
        SELECT semester FROM students WHERE id = ${student.id}
      `;
      const semester = semesterRows[0]?.semester ?? null;

      // 1. Explicitly enrolled subjects in student_subjects (must be isActive = true)
      const enrolledSubjects = await db.$queryRaw<{ id: string; departmentId: string; academicYear: number; semester: number }[]>`
        SELECT s.id, s."departmentId", s."academicYear", s.semester
        FROM student_subjects ss
        JOIN subjects s ON s.id = ss."subjectId"
        WHERE ss."studentId" = ${student.id} AND s."isActive" = true
      `;

      // 2. Active subjects matching student's department + academicYear (+ semester if set)
      let departmentalSubjects: { id: string }[] = [];
      if (student.departmentId) {
        departmentalSubjects = await db.subject.findMany({
          where: {
            departmentId: student.departmentId,
            academicYear: student.academicYear,
            ...(semester !== null ? { semester } : {}),
            isActive: true,
          },
          select: { id: true },
        });
      }

      const subjectIds = Array.from(new Set([
        ...enrolledSubjects.map((s) => s.id),
        ...departmentalSubjects.map((s) => s.id),
      ]));

      return {
        semester,
        coreSubjectIds: subjectIds,
        enrolledSubjectIds: subjectIds,
        subjectIds,
      };
    },
    [`student:${student.id}`, `student-access`]
  );
}

/**
 * Invalidate cached student profile and subject access when data changes
 */
export function invalidateStudentCache(studentIdOrUserId: string) {
  cache.invalidatePattern(`student:${studentIdOrUserId}`);
  cache.invalidatePattern(`student:access:${studentIdOrUserId}`);
  cache.invalidatePattern(`student:user:${studentIdOrUserId}`);
}

type ScopedContentInput = {
  subjectId?: string | null;
  departmentId?: string | null;
  academicYear?: number | null;
  semester?: number | null;
};

export async function canStudentAccessScopedContent(
  student: StudentAccessInput,
  content: ScopedContentInput
) {
  const { semester, subjectIds } = await getStudentSubjectAccess(student);

  // If content is tied to a specific subject, having access to that subject is sufficient
  if (content.subjectId) {
    return subjectIds.includes(content.subjectId);
  }

  const departmentMatches = !content.departmentId || content.departmentId === student.departmentId;
  const yearMatches = content.academicYear === null || content.academicYear === undefined || content.academicYear === student.academicYear;
  const semesterMatches = content.semester === null || content.semester === undefined || !semester || content.semester === semester;

  return departmentMatches && yearMatches && semesterMatches;
}
