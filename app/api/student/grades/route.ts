import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'STUDENT')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: { department: true },
  });
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const subjects = await db.subject.findMany({
    where: { departmentId: student.departmentId, academicYear: student.academicYear },
    select: { id: true, name: true, code: true, semester: true },
  });

  const results = await db.examResult.findMany({
    where: { studentId: student.id },
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

  return NextResponse.json({
    success: true,
    data: {
      student: {
        name: student.userId,
        studentCode: student.studentCode,
        department: student.department.name,
        academicYear: student.academicYear,
      },
      subjects: Object.values(subjectMap),
      hasGrades: results.length > 0,
    },
  });
}
