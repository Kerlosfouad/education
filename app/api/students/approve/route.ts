import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode, generateUniqueBarcode } from '@/lib/codes';
import { sendStudentApprovalEmail } from '@/lib/email';

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

      if (student) {
        // Has Student record - generate barcode/QR
        let barcode = student.barcode;
        if (!barcode) barcode = await generateUniqueBarcode();
        const qrCodeDataUrl = await generateStudentQRCode(student.id);
        await db.student.update({
          where: { id: student.id },
          data: { barcode, qrCode: qrCodeDataUrl, approvedAt: new Date(), approvedBy: session.user.id },
        });
        const loginUrl = `${process.env.NEXTAUTH_URL}/auth/login`;
        await sendStudentApprovalEmail(student.user.email, {
          name: student.user.name || 'Student',
          studentCode: student.studentCode,
          qrCodeDataUrl,
          loginUrl,
        });
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

      return NextResponse.json({ success: true, message: 'Student approved successfully' });
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
