import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode } from '@/lib/codes';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
    const registeredAt = (student.approvedAt || student.user.createdAt).toISOString().slice(0, 10);

    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const pw = page.getWidth();
    const ph = page.getHeight();

    const hFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const rFont = await doc.embedFont(StandardFonts.Helvetica);

    // Header
    page.drawRectangle({ x: 40, y: ph - 100, width: pw - 80, height: 65, color: rgb(0.145, 0.388, 0.922) });
    const t1 = 'Dr. Emad Bayoume Platform';
    page.drawText(t1, { x: (pw - hFont.widthOfTextAtSize(t1, 16)) / 2, y: ph - 65, size: 16, font: hFont, color: rgb(1, 1, 1) });
    const t2 = 'Student Registration Card';
    page.drawText(t2, { x: (pw - rFont.widthOfTextAtSize(t2, 11)) / 2, y: ph - 85, size: 11, font: rFont, color: rgb(0.9, 0.9, 0.9) });

    // Rows
    const rows: [string, string][] = [
      ['Full Name',     student.user.name || 'Student'],
      ['Student Code',  student.studentCode],
      ['Department',    student.department.name],
      ['Academic Year', `Level ${student.academicYear}`],
      ['Phone',         student.phone || '-'],
      ['Email',         student.user.email],
      ['Registered',    registeredAt],
      ['Status',        'Approved'],
    ];

    let y = ph - 130;
    rows.forEach(([label, value], i) => {
      if (i % 2 === 0) page.drawRectangle({ x: 40, y: y - 10, width: pw - 80, height: 26, color: rgb(0.97, 0.98, 0.99) });
      page.drawText(label.toUpperCase(), { x: 52, y: y + 2, size: 9, font: hFont, color: rgb(0.53, 0.53, 0.53) });
      const vw = rFont.widthOfTextAtSize(value, 11);
      page.drawText(value, { x: pw - 52 - vw, y: y + 2, size: 11, font: rFont, color: rgb(0.07, 0.07, 0.07) });
      page.drawLine({ start: { x: 40, y: y - 10 }, end: { x: pw - 40, y: y - 10 }, thickness: 0.5, color: rgb(0.94, 0.94, 0.94) });
      y -= 28;
    });

    // QR Code
    try {
      const commaIdx = qrCodeDataUrl.indexOf(',');
      const b64 = commaIdx >= 0 ? qrCodeDataUrl.slice(commaIdx + 1) : qrCodeDataUrl;
      const qrBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const qrImg = await doc.embedPng(qrBytes);
      const qrSize = 130;
      const qrX = (pw - qrSize) / 2;
      const qrY = y - qrSize - 10;
      page.drawRectangle({ x: qrX - 15, y: qrY - 15, width: qrSize + 30, height: qrSize + 40, color: rgb(0.97, 0.98, 1) });
      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
      const ql = 'Scan to verify student identity';
      page.drawText(ql, { x: (pw - rFont.widthOfTextAtSize(ql, 9)) / 2, y: qrY - 12, size: 9, font: rFont, color: rgb(0.53, 0.53, 0.53) });
    } catch {}

    const pdfBytes = await doc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="registration-${student.studentCode}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 });
  }
}
