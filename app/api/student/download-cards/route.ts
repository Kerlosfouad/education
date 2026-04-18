import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode } from '@/lib/codes';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { NOTO_ARABIC_REGULAR_B64, NOTO_ARABIC_BOLD_B64 } from '@/lib/arabicFonts';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ArabicShaper } = require('arabic-persian-reshaper');

function getArabicFontBytes(bold = false): Uint8Array {
  const b64 = bold ? NOTO_ARABIC_BOLD_B64 : NOTO_ARABIC_REGULAR_B64;
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function prepareArabicForPdf(text: string): string {
  if (!hasArabic(text)) return text;
  const segments = text.split(/(\s+)/);
  const shaped = segments.map(seg => hasArabic(seg) ? ArabicShaper.convertArabic(seg) : seg);
  return shaped.join('').split('').reverse().join('');
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      include: { user: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const qrDataUrl = await generateStudentQRCode(student.id);

    const cols = 3, rows = 2;
    const marginX = 30, marginY = 30;
    const pageW = 595.28;
    const cardW = (pageW - marginX * 2 - (cols - 1) * 10) / cols;
    const qrSize = cardW - 20;
    const cardH = qrSize + 80;
    const totalH = rows * cardH + (rows - 1) * 10;
    const pageH = marginY + 25 + totalH + marginY;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const latinBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const latin     = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const arabicFont = await pdfDoc.embedFont(getArabicFontBytes(false));

    const page = pdfDoc.addPage([pageW, pageH]);

    // Embed QR
    const commaIdx = qrDataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? qrDataUrl.slice(commaIdx + 1) : qrDataUrl;
    const qrImg = await pdfDoc.embedPng(Uint8Array.from(Buffer.from(base64, 'base64')));

    // Title
    const titleText = '6 Attendance Cards';
    const titleW = latinBold.widthOfTextAtSize(titleText, 11);
    page.drawText(titleText, { x: (pageW - titleW) / 2, y: pageH - 18, size: 11, font: latinBold, color: rgb(0.2, 0.2, 0.2) });

    const rawName = student.user.name || 'Student';
    const isAr = hasArabic(rawName);
    const displayName = isAr ? prepareArabicForPdf(rawName) : rawName;
    const nameFont = isAr ? arabicFont : latin;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = marginX + c * (cardW + 10);
        const y = pageH - marginY - 25 - (r + 1) * cardH - r * 10;

        // Card border
        page.drawRectangle({ x, y, width: cardW, height: cardH, borderWidth: 1, borderColor: rgb(0.7, 0.7, 0.7), color: rgb(1, 1, 1) });

        // Header bg
        page.drawRectangle({ x, y: y + cardH - 36, width: cardW, height: 36, color: rgb(0.92, 0.92, 0.92) });

        // Header text
        const headerText = 'Attendance Card';
        const headerW = latinBold.widthOfTextAtSize(headerText, 9);
        page.drawText(headerText, { x: x + (cardW - headerW) / 2, y: y + cardH - 16, size: 9, font: latinBold, color: rgb(0.1, 0.1, 0.1) });

        const subText = 'Dr. Emad Bayoume';
        const subW = latin.widthOfTextAtSize(subText, 7);
        page.drawText(subText, { x: x + (cardW - subW) / 2, y: y + cardH - 28, size: 7, font: latin, color: rgb(0.3, 0.3, 0.3) });

        // Name row
        const nameY = y + cardH - 50;
        page.drawText('Name', { x: x + 8, y: nameY, size: 7, font: latinBold, color: rgb(0.4, 0.4, 0.4) });
        const nameW = nameFont.widthOfTextAtSize(displayName, 8);
        // Right-align name value
        page.drawText(displayName, { x: x + cardW - 8 - nameW, y: nameY, size: 8, font: nameFont, color: rgb(0.1, 0.1, 0.1) });
        page.drawLine({ start: { x: x + 8, y: nameY - 4 }, end: { x: x + cardW - 8, y: nameY - 4 }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });

        // ID row
        const idY = nameY - 16;
        page.drawText('ID', { x: x + 8, y: idY, size: 7, font: latinBold, color: rgb(0.4, 0.4, 0.4) });
        const idVal = student.studentCode;
        const idW = latinBold.widthOfTextAtSize(idVal, 8);
        page.drawText(idVal, { x: x + cardW - 8 - idW, y: idY, size: 8, font: latinBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawLine({ start: { x: x + 8, y: idY - 4 }, end: { x: x + cardW - 8, y: idY - 4 }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });

        // QR
        const qrX = x + (cardW - qrSize) / 2;
        const qrY2 = idY - 8 - qrSize;
        page.drawImage(qrImg, { x: qrX, y: qrY2, width: qrSize, height: qrSize });
      }
    }

    // Footer
    const footer = 'Submit one card per lecture to complete attendance registration';
    const footerW = latin.widthOfTextAtSize(footer, 7);
    page.drawText(footer, { x: (pageW - footerW) / 2, y: 14, size: 7, font: latin, color: rgb(0.5, 0.5, 0.5) });

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
