import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { reshapeArabic, getAmiriFont } from './arabicText';

const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

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

  const amiriBytes = await getAmiriFont();
  const arabicFont = await pdfDoc.embedFont(amiriBytes);
  const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg    = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([595.28, 841.89]);
  const pageWidth  = page.getWidth();
  const pageHeight = page.getHeight();
  const margin = 40;

  const pickFont = (s: string, bold = false): PDFFont =>
    hasArabic(s) ? arabicFont : bold ? fontBold : fontReg;

  const drawCentered = (text: string, y: number, size: number, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
    const prepared = hasArabic(text) ? reshapeArabic(text) : text;
    const font = pickFont(text, bold);
    const w = font.widthOfTextAtSize(prepared, size);
    page.drawText(prepared, { x: (pageWidth - w) / 2, y, size, font, color });
  };

  const drawValue = (text: string, rightEdge: number, y: number, size: number, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
    const prepared = hasArabic(text) ? reshapeArabic(text) : text;
    const font = pickFont(text, bold);
    const w = font.widthOfTextAtSize(prepared, size);
    page.drawText(prepared, { x: rightEdge - w, y, size, font, color });
  };

  // Title
  const title = input.title ?? 'Registration Form';
  drawCentered(title, pageHeight - margin - 30, 22, true, rgb(0.1, 0.1, 0.1));
  drawCentered('Dr. Emad Bayoume Educational System', pageHeight - margin - 54, 12, false, rgb(0.4, 0.4, 0.4));

  const dividerY = pageHeight - margin - 72;
  page.drawLine({ start: { x: margin, y: dividerY }, end: { x: pageWidth - margin, y: dividerY }, thickness: 1.5, color: rgb(0.2, 0.2, 0.2) });

  const rows = [
    { label: 'Student Name', value: input.studentName },
    { label: 'Student Code', value: input.studentCode },
    { label: 'Phone',        value: input.phone?.trim() || '-' },
    { label: 'Email',        value: input.email },
    { label: 'Registered',   value: input.registeredAt.toISOString().slice(0, 10) },
  ];

  const tableTop      = dividerY - 20;
  const rowHeight     = 40;
  const labelColWidth = 160;
  const tableWidth    = pageWidth - margin * 2;
  const tableHeight   = rows.length * rowHeight;
  const valueRightEdge = margin + tableWidth - 10;

  page.drawRectangle({ x: margin, y: tableTop - tableHeight, width: tableWidth, height: tableHeight, borderWidth: 1, borderColor: rgb(0.75, 0.75, 0.75) });
  page.drawLine({ start: { x: margin + labelColWidth, y: tableTop }, end: { x: margin + labelColWidth, y: tableTop - tableHeight }, thickness: 1, color: rgb(0.75, 0.75, 0.75) });

  rows.forEach((r, idx) => {
    const yTop  = tableTop - idx * rowHeight;
    const textY = yTop - rowHeight + 13;
    if (idx > 0) page.drawLine({ start: { x: margin, y: yTop }, end: { x: margin + tableWidth, y: yTop }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });

    // Label - use pickFont in case label is Arabic
    const labelPrepared = hasArabic(r.label) ? reshapeArabic(r.label) : r.label;
    const labelFont = pickFont(r.label, true);
    page.drawText(labelPrepared, { x: margin + 10, y: textY, size: 11, font: labelFont, color: rgb(0.2, 0.2, 0.2) });

    // Value - Arabic right-aligned with arabicFont, Latin left-aligned
    const valuePrepared = hasArabic(r.value) ? reshapeArabic(r.value) : r.value;
    const valueFont = pickFont(r.value, false);
    if (hasArabic(r.value)) {
      const vw = valueFont.widthOfTextAtSize(valuePrepared, 11);
      page.drawText(valuePrepared, { x: valueRightEdge - vw, y: textY, size: 11, font: valueFont, color: rgb(0.1, 0.1, 0.1) });
    } else {
      page.drawText(valuePrepared, { x: margin + labelColWidth + 10, y: textY, size: 11, font: valueFont, color: rgb(0.1, 0.1, 0.1), maxWidth: tableWidth - labelColWidth - 20 });
    }
  });

  // QR Code
  const qrAreaTop = tableTop - tableHeight - 20;
  try {
    const commaIdx = input.qrCodeDataUrl.indexOf(',');
    const base64   = commaIdx >= 0 ? input.qrCodeDataUrl.slice(commaIdx + 1) : input.qrCodeDataUrl;
    const qrImg    = await pdfDoc.embedPng(Uint8Array.from(Buffer.from(base64, 'base64')));
    const qrSize   = 130;
    const qrX      = (pageWidth - qrSize) / 2;
    const qrY      = qrAreaTop - qrSize;
    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    drawCentered('Scan to verify student identity', qrY - 14, 9, false, rgb(0.5, 0.5, 0.5));
    drawCentered('Please print this form and submit it to your professor.', qrY - 34, 10, false, rgb(0.5, 0.5, 0.5));
  } catch {
    drawCentered('Please print this form and submit it to your professor.', qrAreaTop - 20, 10, false, rgb(0.5, 0.5, 0.5));
  }

  return Buffer.from(await pdfDoc.save());
}
