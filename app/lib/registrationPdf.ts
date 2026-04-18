import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { NOTO_ARABIC_REGULAR_B64, NOTO_ARABIC_BOLD_B64 } from './arabicFonts';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ArabicShaper } = require('arabic-persian-reshaper');

function getArabicFontBytes(bold = false): Uint8Array {
  const b64 = bold ? NOTO_ARABIC_BOLD_B64 : NOTO_ARABIC_REGULAR_B64;
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

// Shape + reverse Arabic text for correct RTL rendering in pdf-lib
function prepareArabic(text: string): string {
  const shaped: string = ArabicShaper.convertArabic(text);
  return shaped.split('').reverse().join('');
}

export async function generateStudentRegistrationPdf(input: {
  title?: string;
  studentName: string;
  studentCode: string;
  phone?: string | null;
  email: string;
  registeredAt: Date;
  qrCodeDataUrl: string;
}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Latin fonts (Helvetica - built-in, no encoding issues)
  const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const latinFontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Arabic fonts (NotoSansArabic - embedded as base64)
  const arabicFont = await pdfDoc.embedFont(getArabicFontBytes(false));
  const arabicFontBold = await pdfDoc.embedFont(getArabicFontBytes(true));

  const page = pdfDoc.addPage([595.28, 841.89]);
  const margin = 40;
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  // Pick correct font based on content
  const pickFont = (text: string, bold: boolean): PDFFont =>
    hasArabic(text) ? (bold ? arabicFontBold : arabicFont) : (bold ? latinFontBold : latinFont);

  const drawText = (text: string, x: number, y: number, size: number, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
    const font = pickFont(text, bold);
    const isAr = hasArabic(text);
    const displayText = isAr ? prepareArabic(text) : text;
    const textWidth = font.widthOfTextAtSize(displayText, size);
    // RTL: align to right side of value column
    const drawX = isAr ? (pageWidth - margin - textWidth - (x - margin)) : x;
    page.drawText(displayText, { x: drawX, y, size, font, color });
  };

  const drawCenteredText = (text: string, y: number, size: number, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
    const font = pickFont(text, bold);
    const displayText = hasArabic(text) ? prepareArabic(text) : text;
    const textWidth = font.widthOfTextAtSize(displayText, size);
    page.drawText(displayText, { x: (pageWidth - textWidth) / 2, y, size, font, color });
  };

  // Title
  drawCenteredText(input.title ?? 'Registration Form', pageHeight - margin - 30, 22, true, rgb(0.1, 0.1, 0.1));
  drawCenteredText('Dr. Emad Bayoume Educational System', pageHeight - margin - 54, 12, false, rgb(0.4, 0.4, 0.4));

  // Divider
  const dividerY = pageHeight - margin - 72;
  page.drawLine({ start: { x: margin, y: dividerY }, end: { x: pageWidth - margin, y: dividerY }, thickness: 1.5, color: rgb(0.2, 0.2, 0.2) });

  // Table
  const rows = [
    { label: 'Student Name', value: input.studentName },
    { label: 'Student Code', value: input.studentCode },
    { label: 'Phone',        value: input.phone?.trim() || '-' },
    { label: 'Email',        value: input.email },
    { label: 'Registered',   value: input.registeredAt.toISOString().slice(0, 10) },
  ];

  const tableTop = dividerY - 20;
  const rowHeight = 40;
  const labelColWidth = 160;
  const tableWidth = pageWidth - margin * 2;
  const tableHeight = rows.length * rowHeight;

  page.drawRectangle({ x: margin, y: tableTop - tableHeight, width: tableWidth, height: tableHeight, borderWidth: 1, borderColor: rgb(0.75, 0.75, 0.75) });
  page.drawLine({ start: { x: margin + labelColWidth, y: tableTop }, end: { x: margin + labelColWidth, y: tableTop - tableHeight }, thickness: 1, color: rgb(0.75, 0.75, 0.75) });

  rows.forEach((r, idx) => {
    const yTop = tableTop - idx * rowHeight;
    const textY = yTop - rowHeight + 13;
    if (idx > 0) page.drawLine({ start: { x: margin, y: yTop }, end: { x: margin + tableWidth, y: yTop }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    drawText(r.label, margin + 10, textY, 11, true, rgb(0.2, 0.2, 0.2));
    drawText(r.value, margin + labelColWidth + 10, textY, 11, false, rgb(0.1, 0.1, 0.1));
  });

  // QR Code
  const qrAreaTop = tableTop - tableHeight - 20;
  try {
    const commaIdx = input.qrCodeDataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? input.qrCodeDataUrl.slice(commaIdx + 1) : input.qrCodeDataUrl;
    const qrImg = await pdfDoc.embedPng(Uint8Array.from(Buffer.from(base64, 'base64')));
    const qrSize = 130;
    const qrX = (pageWidth - qrSize) / 2;
    const qrY = qrAreaTop - qrSize;
    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    drawCenteredText('Scan to verify student identity', qrY - 14, 9, false, rgb(0.5, 0.5, 0.5));
    drawCenteredText('Please print this form and submit it to your professor.', qrY - 34, 10, false, rgb(0.5, 0.5, 0.5));
  } catch {
    drawCenteredText('Please print this form and submit it to your professor.', qrAreaTop - 20, 10, false, rgb(0.5, 0.5, 0.5));
  }

  return Buffer.from(await pdfDoc.save());
}
