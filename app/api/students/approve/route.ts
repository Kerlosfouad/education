import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode, generateUniqueBarcode } from '@/lib/codes';
import { sendStudentApprovalEmail } from '@/lib/email';
import { generateStudentRegistrationPdf } from '@/lib/registrationPdf';

// POST /api/students/approve - Approve a student
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { studentId, userId: directUserId, action, reason } = body;

    if ((!studentId && !directUserId) || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Try to find student by Student.id first, then by userId
    let student = studentId
      ? await db.student.findUnique({ where: { id: studentId }, include: { user: true, department: true } })
      : await db.student.findUnique({ where: { userId: directUserId }, include: { user: true, department: true } });

    const targetUserId = student?.userId ?? directUserId;
    if (!targetUserId) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (action === 'approve') {
      if (!student) {
        return NextResponse.json(
          { error: 'Cannot approve account before profile completion' },
          { status: 400 }
        );
      }

      await db.user.update({ where: { id: targetUserId }, data: { status: 'ACTIVE' } });
      await db.notification.create({
        data: {
          userId: targetUserId,
          title: 'Registration Approved',
          message: 'Your registration has been approved. You can now login to the platform.',
          type: 'APPROVAL',
        },
      });

      let emailSent = false;

      if (student) {
        // Has Student record - generate barcode/QR
        let barcode = student.barcode;
        if (!barcode) barcode = await generateUniqueBarcode();
        const qrCodeDataUrl = await generateStudentQRCode(student.id);
        await db.student.update({
          where: { id: student.id },
          data: { barcode, qrCode: qrCodeDataUrl, approvedAt: new Date(), approvedBy: session.user.id },
        });

        // Email/PDF must not block account approval.
        try {
          const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '';
          const loginUrl = baseUrl ? `${baseUrl}/auth/login` : '/auth/login';

          const registrationPdf = await generateStudentRegistrationPdf({
            title: 'Registration Form',
            studentName: student.user.name || 'Student',
            studentCode: student.studentCode,
            phone: student.phone,
            email: student.user.email,
            registeredAt: new Date(),
            qrCodeDataUrl,
          });

          emailSent = await sendStudentApprovalEmail(student.user.email, {
            name: student.user.name || 'Student',
            studentCode: student.studentCode,
            qrCodeDataUrl,
            loginUrl,
            registrationPdf: {
              filename: `registration-${student.studentCode}.pdf`,
              content: registrationPdf,
            },
          });
        } catch (mailError) {
          console.error('Approval email/pdf generation failed:', mailError);
        }
      }

      return NextResponse.json({
        success: true,
        message: emailSent
          ? 'Student approved successfully'
          : 'Student approved successfully (email may not have been sent)',
      });
    } else if (action === 'reject') {
      await db.user.update({ where: { id: targetUserId }, data: { status: 'REJECTED' } });
      await db.notification.create({
        data: {
          userId: targetUserId,
          title: 'Registration Rejected',
          message: reason || 'Your registration has been rejected.',
          type: 'APPROVAL',
        },
      });
      return NextResponse.json({ success: true, message: 'Student rejected successfully' });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error approving student:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
