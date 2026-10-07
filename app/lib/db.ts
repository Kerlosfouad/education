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
 * Get student record for a given userId. Returns null if not found.
 */
export async function getOrCreateStudent(userId: string) {
  const student = await db.student.findUnique({ where: { userId } });
  return student || null;
}

type StudentAccessInput = {
  id: string;
  departmentId: string;
  academicYear: number;
};

export async function getStudentSubjectAccess(student: StudentAccessInput) {
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

  let subjectIds = Array.from(new Set(enrolledSubjects.map((subject) => subject.id)));

  // Fallback: if student has no explicit student_subjects rows, find active subjects by department + academicYear (+ semester)
  if (subjectIds.length === 0 && student.departmentId) {
    const fallbackSubjects = await db.subject.findMany({
      where: {
        departmentId: student.departmentId,
        academicYear: student.academicYear,
        ...(semester !== null ? { semester } : {}),
        isActive: true,
      },
      select: { id: true },
    });
    subjectIds = fallbackSubjects.map(s => s.id);
  }

  return {
    semester,
    coreSubjectIds: subjectIds,
    enrolledSubjectIds: subjectIds,
    subjectIds,
  };
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

  // If content has a specific subject, student must have access to that subject
  if (content.subjectId) {
    if (!subjectIds.includes(content.subjectId)) return false;
    // Also verify department / academicYear / semester if explicitly provided
    if (content.departmentId && content.departmentId !== student.departmentId) return false;
    if (content.academicYear !== null && content.academicYear !== undefined && content.academicYear !== student.academicYear) return false;
    if (content.semester !== null && content.semester !== undefined && semester !== null && content.semester !== semester) return false;
    return true;
  }

  const departmentMatches = !content.departmentId || content.departmentId === student.departmentId;
  const yearMatches = content.academicYear === null || content.academicYear === undefined || content.academicYear === student.academicYear;
  const semesterMatches = content.semester === null || content.semester === undefined || !semester || content.semester === semester;

  return departmentMatches && yearMatches && semesterMatches;
}
