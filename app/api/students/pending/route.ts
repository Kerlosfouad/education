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
        status: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            studentCode: true,
            academicYear: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Normalize to a consistent shape
    const data = pendingUsers.map(u => ({
      id: u.student!.id,
      userId: u.id,
      studentCode: u.student!.studentCode,
      academicYear: u.student!.academicYear,
      department: { name: u.student!.department.name },
      user: {
        name: u.name ?? '',
        email: u.email,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
      },
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
