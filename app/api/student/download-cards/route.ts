import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode } from '@/lib/codes';
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { reshapeArabic, getAmiriFont } from '@/lib/arabicText';

const isArabic = (s: string) => /[\u0600-\u06FF]/.test(s);
const prep = (s: string) => isArabic(s) ? reshapeArabic(s) : s;

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

    const cols = 3, rows = 2, mx = 30, my = 30;
    const pageW = 595.28;
    const cardW = (pageW - mx * 2 - (cols - 1) * 10) / cols;
    const qrSize = cardW - 20;
    const cardH = qrSize + 80;
    const pageH = my + 25 + rows * cardH + (rows - 1) * 10 + my;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const amiriFont = await pdfDoc.embedFont(await getAmiriFont());
    const fontB     = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontR     = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const af = (s: string): PDFFont => isArabic(s) ? amiriFont : fontR;

    const page = pdfDoc.addPage([pageW, pageH]);

    // Embed QR
    const b64 = qrDataUrl.includes(',') ? qrDataUrl.split(',')[1] : qrDataUrl;
    const qrImg = await pdfDoc.embedPng(Uint8Array.from(Buffer.from(b64, 'base64')));

    // Title
    const title = '6 Attendance Cards';
    page.drawText(title, { x: (pageW - fontB.widthOfTextAtSize(title, 11)) / 2, y: pageH - 18, size: 11, font: fontB, color: rgb(0.2,0.2,0.2) });

    const rawName = student.user.name || 'Student';
    const nameText = prep(rawName);
    const nameFont = af(rawName);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = mx + c * (cardW + 10);
        const y = pageH - my - 25 - (r + 1) * cardH - r * 10;

        // Card
        page.drawRectangle({ x, y, width: cardW, height: cardH, borderWidth: 1, borderColor: rgb(0.7,0.7,0.7), color: rgb(1,1,1) });
        page.drawRectangle({ x, y: y + cardH - 36, width: cardW, height: 36, color: rgb(0.92,0.92,0.92) });

        // Header
        const ht = 'Attendance Card';
        page.drawText(ht, { x: x + (cardW - fontB.widthOfTextAtSize(ht, 9)) / 2, y: y + cardH - 16, size: 9, font: fontB, color: rgb(0.1,0.1,0.1) });
        const st = 'Dr. Emad Bayoume';
        page.drawText(st, { x: x + (cardW - fontR.widthOfTextAtSize(st, 7)) / 2, y: y + cardH - 28, size: 7, font: fontR, color: rgb(0.3,0.3,0.3) });

        // Name row
        const nameY = y + cardH - 50;
        page.drawText('Name', { x: x + 8, y: nameY, size: 7, font: fontB, color: rgb(0.4,0.4,0.4) });
        const nw = nameFont.widthOfTextAtSize(nameText, 8);
        page.drawText(nameText, { x: x + cardW - 8 - nw, y: nameY, size: 8, font: nameFont, color: rgb(0.1,0.1,0.1) });
        page.drawLine({ start: { x: x + 8, y: nameY - 4 }, end: { x: x + cardW - 8, y: nameY - 4 }, thickness: 0.3, color: rgb(0.8,0.8,0.8) });

        // ID row
        const idY = nameY - 16;
        page.drawText('ID', { x: x + 8, y: idY, size: 7, font: fontB, color: rgb(0.4,0.4,0.4) });
        const iw = fontB.widthOfTextAtSize(student.studentCode, 8);
        page.drawText(student.studentCode, { x: x + cardW - 8 - iw, y: idY, size: 8, font: fontB, color: rgb(0.1,0.1,0.1) });
        page.drawLine({ start: { x: x + 8, y: idY - 4 }, end: { x: x + cardW - 8, y: idY - 4 }, thickness: 0.3, color: rgb(0.8,0.8,0.8) });

        // QR
        page.drawImage(qrImg, { x: x + (cardW - qrSize) / 2, y: idY - 8 - qrSize, width: qrSize, height: qrSize });
      }
    }

    const footer = 'Submit one card per lecture to complete attendance registration';
    page.drawText(footer, { x: (pageW - fontR.widthOfTextAtSize(footer, 7)) / 2, y: 14, size: 7, font: fontR, color: rgb(0.5,0.5,0.5) });

    const bytes = await pdfDoc.save();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cards-${student.studentCode}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed: ' + String(error) }, { status: 500 });
  }
}
