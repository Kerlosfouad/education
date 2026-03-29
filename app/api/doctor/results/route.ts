import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const students = await db.student.findMany({
      include: {
        user: { select: { name: true, email: true } },
        department: { select: { name: true } },
        assignmentSubmissions: {
          include: {
            assignment: {
              select: {
                title: true,
                maxScore: true,
                subject: { select: { name: true } },
              },
            },
          },
        },
        quizAttempts: {
          where: { status: 'COMPLETED' },
          include: {
            quiz: {
              select: {
                title: true,
                subject: { select: { name: true } },
              },
            },
          },
        },
        examResults: {
          include: {
            subject: { select: { name: true } },
          },
        },
        attendances: {
          where: { verificationMethod: { not: 'ABSENT' } },
          include: {
            session: {
              select: { title: true, openTime: true },
            },
          },
          orderBy: { timestamp: 'asc' },
        },
      },
      orderBy: [
        { department: { name: 'asc' } },
        { academicYear: 'asc' },
        { user: { name: 'asc' } },
      ],
    });

    return NextResponse.json(students);
  } catch (error) {
    console.error('Results API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
