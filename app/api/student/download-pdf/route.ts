import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode } from '@/lib/codes';
import { generateStudentRegistrationPdf } from '@/lib/registrationPdf';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      include: { user: true, department: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Always generate a fresh QR code to avoid stored format issues
    let qrCodeDataUrl: string;
    try {
      qrCodeDataUrl = await generateStudentQRCode(student.id);
    } catch (qrError) {
      console.error('QR generation failed:', qrError);
      return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
    }

    let pdf: Buffer;
    try {
      pdf = await generateStudentRegistrationPdf({
        title: 'Registration Form',
        studentName: student.user.name || 'Student',
        studentCode: student.studentCode,
        phone: student.phone,
        email: student.user.email,
        registeredAt: student.approvedAt || student.user.createdAt,
        qrCodeDataUrl,
      });
    } catch (pdfError) {
      console.error('PDF generation failed:', pdfError);
      return NextResponse.json({ error: 'Failed to generate PDF: ' + String(pdfError) }, { status: 500 });
    }

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="registration-${student.studentCode}.pdf"`,
        'Content-Length': String(pdf.length),
      },
    });
  } catch (error) {
    console.error('PDF download error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 });
  }
}
