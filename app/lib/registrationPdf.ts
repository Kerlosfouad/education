import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import path from 'path';
import fs from 'fs/promises';

function decodeDataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

function rtlText(input: string) {
  const text = (input ?? '').toString();
  if (!text) return '';
  try {
    // Create Arabic presentation forms (connected glyphs),
    // then reverse to approximate RTL rendering in PDF text drawing.
    // This yields clear Arabic for names/labels in most cases.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const reshaper = require('arabic-persian-reshaper');
    const reshaped: string = reshaper.reshape(text);
    return reshaped.split('').reverse().join('');
  } catch {
    return text.split('').reverse().join('');
  }
}

async function loadArabicFonts() {
  const regularPath = path.join(process.cwd(), 'node_modules', 'noto-sans-arabic', 'fonts', 'Regular.ttf');
  const boldPath = path.join(process.cwd(), 'node_modules', 'noto-sans-arabic', 'fonts', 'Bold.ttf');
  const [regularBytes, boldBytes] = await Promise.all([fs.readFile(regularPath), fs.readFile(boldPath)]);
  return { regularBytes, boldBytes };
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
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait (pt)

  const { regularBytes, boldBytes } = await loadArabicFonts();
  const font = await pdfDoc.embedFont(regularBytes);
  const fontBold = await pdfDoc.embedFont(boldBytes);

  const margin = 40;
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  const headerY = pageHeight - margin - 20;
  const title = rtlText(input.title ?? 'استمارة تسجيل');
  const titleSize = 22;
  const titleWidth = fontBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: pageWidth - margin - titleWidth,
    y: headerY,
    size: titleSize,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  const sub = rtlText('Dr. Emad Bayoume');
  const subSize = 16;
  const subWidth = font.widthOfTextAtSize(sub, subSize);
  page.drawText(sub, {
    x: pageWidth - margin - subWidth,
    y: headerY - 26,
    size: subSize,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });

  // QR code (top-left block)
  const qrBytes = decodeDataUrlToBytes(input.qrCodeDataUrl);
  const qrImg = await pdfDoc.embedPng(qrBytes);
  const qrSize = 110;
  page.drawImage(qrImg, {
    x: pageWidth - margin - qrSize,
    y: pageHeight - margin - qrSize,
    width: qrSize,
    height: qrSize,
  });

  // Divider line
  const lineY = headerY - 50;
  page.drawLine({
    start: { x: margin, y: lineY },
    end: { x: pageWidth - margin, y: lineY },
    thickness: 2,
    color: rgb(0.15, 0.15, 0.15),
  });

  // Table
  const tableTop = lineY - 30;
  const tableLeft = margin;
  const tableRight = pageWidth - margin;
  const tableWidth = tableRight - tableLeft;

  const rows: Array<{ label: string; value: string }> = [
    { label: 'الاسم', value: input.studentName },
    { label: 'ID', value: input.studentCode },
    { label: 'رقم الهاتف', value: input.phone?.trim() ? input.phone : '—' },
    { label: 'البريد الالكتروني', value: input.email },
    { label: 'تاريخ التسجيل', value: input.registeredAt.toISOString().slice(0, 19).replace('T', ' ') },
  ];

  const rowHeight = 46;
  const labelColWidth = 150;
  const valueColWidth = tableWidth - labelColWidth;

  // Outer border
  const tableHeight = rows.length * rowHeight;
  page.drawRectangle({
    x: tableLeft,
    y: tableTop - tableHeight,
    width: tableWidth,
    height: tableHeight,
    borderWidth: 1,
    borderColor: rgb(0.75, 0.75, 0.75),
  });

  // Vertical separator
  page.drawLine({
    start: { x: tableLeft + valueColWidth, y: tableTop },
    end: { x: tableLeft + valueColWidth, y: tableTop - tableHeight },
    thickness: 1,
    color: rgb(0.75, 0.75, 0.75),
  });

  rows.forEach((r, idx) => {
    const yTop = tableTop - idx * rowHeight;
    const yBottom = yTop - rowHeight;

    // Row separator
    if (idx > 0) {
      page.drawLine({
        start: { x: tableLeft, y: yTop },
        end: { x: tableRight, y: yTop },
        thickness: 1,
        color: rgb(0.85, 0.85, 0.85),
      });
    }

    const textY = yBottom + 16;
    const label = rtlText(r.label);
    const labelSize = 12;
    const labelWidth = fontBold.widthOfTextAtSize(label, labelSize);
    page.drawText(label, {
      x: tableRight - 12 - labelWidth,
      y: textY,
      size: labelSize,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.15),
    });

    const value = r.value ?? '';
    const maybeArabic = /[\u0600-\u06FF]/.test(value) ? rtlText(value) : value;
    page.drawText(maybeArabic, {
      x: tableLeft + 12,
      y: textY,
      size: 12,
      font: font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: valueColWidth - 24,
    });
  });

  const footerY = tableTop - tableHeight - 70;
  const footer = rtlText('على كل طالب طباعة استمارة التسجيل وتسليمها إلى أستاذ المادة.');
  const footerSize = 11;
  const footerWidth = font.widthOfTextAtSize(footer, footerSize);
  page.drawText(footer, {
    x: pageWidth - margin - footerWidth,
    y: footerY,
    size: footerSize,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

