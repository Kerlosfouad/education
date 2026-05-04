import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/students/pending - Get all users with PENDING status (students waiting approval)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only show pending users that already completed profile.
    const pendingUsers = await db.user.findMany({
      where: {
        role: 'STUDENT',
        status: 'PENDING',
        student: { isNot: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        status: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            studentCode: true,
            academicYear: true,
            departmentId: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get all unique dept+year combos to batch fetch subjects
    const combos = Array.from(new Set(pendingUsers.map(u => `${u.student!.departmentId}|${u.student!.academicYear}`)));
    const subjectMap: Record<string, string[]> = {};
    await Promise.all(combos.map(async combo => {
      const [deptId, year] = combo.split('|');
      const subs = await db.subject.findMany({
        where: { departmentId: deptId, academicYear: Number(year), isActive: true },
        select: { name: true },
      });
      subjectMap[combo] = subs.map(s => s.name);
    }));

    // Normalize to a consistent shape
    const data = pendingUsers.map(u => {
      const key = `${u.student!.departmentId}|${u.student!.academicYear}`;
      return {
        id: u.student!.id,
        userId: u.id,
        studentCode: u.student!.studentCode,
        academicYear: u.student!.academicYear,
        department: { name: u.student!.department.name },
        subjects: subjectMap[key] ?? [],
        user: {
          name: u.name ?? '',
          email: u.email,
          image: u.image ?? null,
          status: u.status,
          createdAt: u.createdAt.toISOString(),
        },
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
