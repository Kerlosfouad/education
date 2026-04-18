import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const FONT_URLS = {
  regular: 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyvu3CBFQLaig.woff2',
  bold: 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyvu3CBFQLaig.woff2',
};

// Cache fonts in memory to avoid repeated fetches
let cachedRegular: Uint8Array | null = null;
let cachedBold: Uint8Array | null = null;

async function loadArabicFont(bold = false): Promise<Uint8Array> {
  if (bold && cachedBold) return cachedBold;
  if (!bold && cachedRegular) return cachedRegular;

  // Try local public folder first
  try {
    const { default: fs } = await import('fs');
    const { default: path } = await import('path');
    const filename = bold ? 'NotoSansArabic-Bold.ttf' : 'NotoSansArabic-Regular.ttf';
    const candidates = [
      path.join(process.cwd(), 'public', 'fonts', filename),
      path.join('/var/task', 'public', 'fonts', filename),
      path.join('/var/task', '.next', 'server', 'public', 'fonts', filename),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const bytes = new Uint8Array(fs.readFileSync(p));
        if (bold) cachedBold = bytes; else cachedRegular = bytes;
        return bytes;
      }
    }
  } catch {}

  // Fallback: fetch from Google Fonts CDN
  const url = bold ? FONT_URLS.bold : FONT_URLS.regular;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch font from CDN`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bold) cachedBold = bytes; else cachedRegular = bytes;
  return bytes;
}

// Arabic text needs to be reversed for RTL rendering in pdf-lib
function prepareArabic(text: string): string {
  // Reverse the string for RTL display
  return text.split('').reverse().join('');
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
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

  const arabicFontBytes = await loadArabicFont(false);
  const arabicFontBoldBytes = await loadArabicFont(true);

  const arabicFont = await pdfDoc.embedFont(arabicFontBytes);
  const arabicFontBold = await pdfDoc.embedFont(arabicFontBoldBytes);

  const page = pdfDoc.addPage([595.28, 841.89]);
  const margin = 40;
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  // Helper: draw text supporting Arabic (RTL) or Latin
  const drawText = (text: string, x: number, y: number, size: number, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
    const font = bold ? arabicFontBold : arabicFont;
    const isAr = hasArabic(text);
    const displayText = isAr ? prepareArabic(text) : text;
    const textWidth = font.widthOfTextAtSize(displayText, size);
    const drawX = isAr ? (pageWidth - margin - textWidth - (x - margin)) : x;
    page.drawText(displayText, { x: drawX, y, size, font, color });
  };

  const drawCenteredText = (text: string, y: number, size: number, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
    const font = bold ? arabicFontBold : arabicFont;
    const displayText = hasArabic(text) ? prepareArabic(text) : text;
    const textWidth = font.widthOfTextAtSize(displayText, size);
    page.drawText(displayText, { x: (pageWidth - textWidth) / 2, y, size, font, color });
  };

  // Title
  const title = input.title ?? 'Registration Form';
  drawCenteredText(title, pageHeight - margin - 30, 22, true, rgb(0.1, 0.1, 0.1));

  const sub = 'Dr. Emad Bayoume Educational System';
  drawCenteredText(sub, pageHeight - margin - 54, 12, false, rgb(0.4, 0.4, 0.4));

  // Divider
  const dividerY = pageHeight - margin - 72;
  page.drawLine({
    start: { x: margin, y: dividerY },
    end: { x: pageWidth - margin, y: dividerY },
    thickness: 1.5,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Table rows
  const rows = [
    { label: 'Student Name', value: input.studentName },
    { label: 'Student Code', value: input.studentCode },
    { label: 'Phone', value: input.phone?.trim() || '-' },
    { label: 'Email', value: input.email },
    { label: 'Registration Date', value: input.registeredAt.toISOString().slice(0, 10) },
  ];

  const tableTop = dividerY - 20;
  const rowHeight = 40;
  const labelColWidth = 160;
  const tableWidth = pageWidth - margin * 2;
  const tableHeight = rows.length * rowHeight;

  page.drawRectangle({
    x: margin, y: tableTop - tableHeight,
    width: tableWidth, height: tableHeight,
    borderWidth: 1, borderColor: rgb(0.75, 0.75, 0.75),
  });

  page.drawLine({
    start: { x: margin + labelColWidth, y: tableTop },
    end: { x: margin + labelColWidth, y: tableTop - tableHeight },
    thickness: 1, color: rgb(0.75, 0.75, 0.75),
  });

  rows.forEach((r, idx) => {
    const yTop = tableTop - idx * rowHeight;
    const textY = yTop - rowHeight + 13;
    if (idx > 0) {
      page.drawLine({
        start: { x: margin, y: yTop },
        end: { x: margin + tableWidth, y: yTop },
        thickness: 0.5, color: rgb(0.85, 0.85, 0.85),
      });
    }
    drawText(r.label, margin + 10, textY, 11, true, rgb(0.2, 0.2, 0.2));
    drawText(r.value, margin + labelColWidth + 10, textY, 11, false, rgb(0.1, 0.1, 0.1));
  });

  // QR Code
  const qrAreaTop = tableTop - tableHeight - 20;
  try {
    const commaIdx = input.qrCodeDataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? input.qrCodeDataUrl.slice(commaIdx + 1) : input.qrCodeDataUrl;
    const qrBytes = Uint8Array.from(Buffer.from(base64, 'base64'));
    const qrImg = await pdfDoc.embedPng(qrBytes);
    const qrSize = 130;
    const qrX = (pageWidth - qrSize) / 2;
    const qrY = qrAreaTop - qrSize;
    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    drawCenteredText('Scan to verify student identity', qrY - 14, 9, false, rgb(0.5, 0.5, 0.5));
    drawCenteredText('Please print this form and submit it to your professor.', qrY - 34, 10, false, rgb(0.5, 0.5, 0.5));
  } catch {
    drawCenteredText('Please print this form and submit it to your professor.', qrAreaTop - 20, 10, false, rgb(0.5, 0.5, 0.5));
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
