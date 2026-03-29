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
      include: { user: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const qrDataUrl = student.qrCode || await generateStudentQRCode(student.id);

    // A4 page
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Embed QR
    const commaIdx = qrDataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? qrDataUrl.slice(commaIdx + 1) : qrDataUrl;
    const qrBytes = Uint8Array.from(Buffer.from(base64, 'base64'));
    const qrImg = await pdfDoc.embedPng(qrBytes);

    const cols = 3;
    const rows = 2;
    const marginX = 30;
    const marginY = 30;
    const pageW = page.getWidth();
    const pageH = page.getHeight();
    const cardW = (pageW - marginX * 2 - (cols - 1) * 10) / cols;
    const cardH = (pageH - marginY * 2 - (rows - 1) * 10) / rows;

    // Title
    const titleText = '6 Attendance Cards';
    const titleW = font.widthOfTextAtSize(titleText, 11);
    page.drawText(titleText, {
      x: (pageW - titleW) / 2,
      y: pageH - 18,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = marginX + c * (cardW + 10);
        const y = pageH - marginY - 25 - (r + 1) * cardH - r * 10;

        // Card border
        page.drawRectangle({
          x, y, width: cardW, height: cardH,
          borderWidth: 1,
          borderColor: rgb(0.7, 0.7, 0.7),
          color: rgb(1, 1, 1),
        });

        // Header bg
        page.drawRectangle({
          x, y: y + cardH - 36,
          width: cardW, height: 36,
          color: rgb(0.92, 0.92, 0.92),
        });

        // Header text
        const headerText = 'Attendance Card';
        const headerW = font.widthOfTextAtSize(headerText, 9);
        page.drawText(headerText, {
          x: x + (cardW - headerW) / 2,
          y: y + cardH - 16,
          size: 9, font,
          color: rgb(0.1, 0.1, 0.1),
        });

        const subText = 'Dr. Emad Bayoume';
        const subW = fontReg.widthOfTextAtSize(subText, 7);
        page.drawText(subText, {
          x: x + (cardW - subW) / 2,
          y: y + cardH - 28,
          size: 7, font: fontReg,
          color: rgb(0.3, 0.3, 0.3),
        });

        // Name row
        const nameY = y + cardH - 50;
        page.drawText('Name', { x: x + 8, y: nameY, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
        const nameVal = student.user.name || 'Student';
        const nameValW = fontReg.widthOfTextAtSize(nameVal, 8);
        page.drawText(nameVal, { x: x + cardW - 8 - nameValW, y: nameY, size: 8, font: fontReg, color: rgb(0.1, 0.1, 0.1) });
        page.drawLine({ start: { x: x + 8, y: nameY - 4 }, end: { x: x + cardW - 8, y: nameY - 4 }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });

        // ID row
        const idY = nameY - 16;
        page.drawText('ID', { x: x + 8, y: idY, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
        const idVal = student.studentCode;
        const idValW = font.widthOfTextAtSize(idVal, 8);
        page.drawText(idVal, { x: x + cardW - 8 - idValW, y: idY, size: 8, font, color: rgb(0.1, 0.1, 0.1) });
        page.drawLine({ start: { x: x + 8, y: idY - 4 }, end: { x: x + cardW - 8, y: idY - 4 }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });

        // QR code - fixed size, right below ID row with small gap
        const qrSize = Math.min(cardW - 20, cardH - 90);
        const qrX = x + (cardW - qrSize) / 2;
        const qrY = idY - 10 - qrSize;
        page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
      }
    }

    // Footer
    const footer = 'Submit one card per lecture to complete attendance registration';
    const footerW = fontReg.widthOfTextAtSize(footer, 7);
    page.drawText(footer, {
      x: (pageW - footerW) / 2,
      y: 14,
      size: 7, font: fontReg,
      color: rgb(0.5, 0.5, 0.5),
    });

    const bytes = await pdfDoc.save();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cards-${student.studentCode}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Cards PDF error:', error);
    return NextResponse.json({ error: 'Failed to generate cards: ' + String(error) }, { status: 500 });
  }
}
