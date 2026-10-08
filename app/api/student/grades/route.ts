export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, getOrCreateStudent, getStudentSubjectAccess } from '@/lib/db';
import { cache } from '@/lib/cache';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'STUDENT')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const student = await getOrCreateStudent(session.user.id);
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const data = await cache.remember(
    `student:grades:${student.id}`,
    30, // 30 seconds
    async () => {
      const fullStudent = await db.student.findUnique({
        where: { id: student.id },
        include: { department: true, user: { select: { name: true } } },
      });
      if (!fullStudent) return null;

      const { subjectIds } = await getStudentSubjectAccess(fullStudent);

      const results = await db.examResult.findMany({
        where: { studentId: fullStudent.id, subjectId: { in: subjectIds } },
        include: { subject: { select: { id: true, name: true, code: true, semester: true } } },
      });

      // Group by subject
      const subjectMap: Record<string, { subjectId: string; subjectName: string; subjectCode: string; semester: number; grades: { examType: string; score: number; maxScore: number; percentage: number }[]; total: number; maxTotal: number }> = {};

      results.forEach(r => {
        const sid = r.subjectId;
        if (!subjectMap[sid]) {
          subjectMap[sid] = {
            subjectId: sid,
            subjectName: r.subject.name,
            subjectCode: r.subject.code,
            semester: r.subject.semester,
            grades: [],
            total: 0,
            maxTotal: 0,
          };
        }
        subjectMap[sid].grades.push({
          examType: r.examType,
          score: r.score,
          maxScore: r.maxScore,
          percentage: r.percentage,
        });
        subjectMap[sid].total += r.score;
        subjectMap[sid].maxTotal += r.maxScore;
      });

      return {
        student: {
          name: fullStudent.user.name,
          studentCode: fullStudent.studentCode,
          department: fullStudent.department.name,
          academicYear: fullStudent.academicYear,
        },
        subjects: Object.values(subjectMap),
        hasGrades: results.length > 0,
      };
    },
    [`student:${student.id}`]
  );

  if (!data) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  return NextResponse.json({
    success: true,
    data,
  });
}
