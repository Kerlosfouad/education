import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode } from '@/lib/codes';
import { generateStudentRegistrationPdf } from '@/lib/registrationPdf';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      include: { user: true, department: true },
    });

    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const qrCodeDataUrl = student.qrCode || await generateStudentQRCode(student.id);

    const pdf = await generateStudentRegistrationPdf({
      title: 'استمارة تسجيل',
      studentName: student.user.name || 'Student',
      studentCode: student.studentCode,
      phone: student.phone,
      email: student.user.email,
      registeredAt: student.approvedAt || student.user.createdAt,
      qrCodeDataUrl,
    });

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="registration-${student.studentCode}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF download error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
