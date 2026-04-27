import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode } from '@/lib/codes';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      include: { user: true, department: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const qrCodeDataUrl = await generateStudentQRCode(student.id);

    return NextResponse.json({
      success: true,
      data: {
        name: student.user.name || 'Student',
        studentCode: student.studentCode,
        department: student.department.name,
        academicYear: student.academicYear,
        phone: student.phone || '-',
        email: student.user.email,
        registeredAt: (student.approvedAt || student.user.createdAt).toISOString().slice(0, 10),
        qrCodeDataUrl,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
