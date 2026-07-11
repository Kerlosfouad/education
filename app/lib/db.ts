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

  const coreWhere: any = {
    departmentId: student.departmentId,
    academicYear: student.academicYear,
  };
  if (semester) coreWhere.semester = semester;

  const [coreSubjects, enrolledSubjects] = await Promise.all([
    db.subject.findMany({
      where: coreWhere,
      select: { id: true, departmentId: true, academicYear: true, semester: true },
    }),
    db.$queryRaw<{ id: string; departmentId: string; academicYear: number; semester: number }[]>`
      SELECT s.id, s."departmentId", s."academicYear", s.semester
      FROM student_subjects ss
      JOIN subjects s ON s.id = ss."subjectId"
      WHERE ss."studentId" = ${student.id}
    `,
  ]);

  const allSubjects = [...coreSubjects, ...enrolledSubjects];
  const subjectIds = Array.from(new Set(allSubjects.map((subject) => subject.id)));

  return {
    semester,
    coreSubjectIds: coreSubjects.map((subject) => subject.id),
    enrolledSubjectIds: enrolledSubjects.map((subject) => subject.id),
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

  if (content.subjectId) return subjectIds.includes(content.subjectId);

  const departmentMatches = !content.departmentId || content.departmentId === student.departmentId;
  const yearMatches = content.academicYear === null || content.academicYear === undefined || content.academicYear === student.academicYear;
  const semesterMatches = content.semester === null || content.semester === undefined || !semester || content.semester === semester;

  return departmentMatches && yearMatches && semesterMatches;
}
