import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Transliterate Arabic to Latin so Helvetica can render it
function toLatinSafe(text: string): string {
  const map: Record<string, string> = {
    'ا':'a','أ':'a','إ':'i','آ':'aa','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h',
    'خ':'kh','د':'d','ذ':'dh','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d',
    'ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m',
    'ن':'n','ه':'h','ة':'h','و':'w','ي':'y','ى':'a','ئ':'y','ء':'','ؤ':'w',
    '\u0640':'','\u064B':'','\u064C':'','\u064D':'','\u064E':'','\u064F':'',
    '\u0650':'','\u0651':'','\u0652':'',
  };
  return text.split('').map(c => map[c] !== undefined ? map[c] : c.charCodeAt(0) > 127 ? '' : c).join('');
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
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  const title = input.title ?? 'Registration Form';
  const titleW = fontBold.widthOfTextAtSize(title, 22);
  page.drawText(title, { x: (pageWidth - titleW) / 2, y: pageHeight - margin - 30, size: 22, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  const sub = 'Dr. Emad Bayoume Educational System';
  const subW = font.widthOfTextAtSize(sub, 12);
  page.drawText(sub, { x: (pageWidth - subW) / 2, y: pageHeight - margin - 54, size: 12, font, color: rgb(0.4, 0.4, 0.4) });

  const dividerY = pageHeight - margin - 72;
  page.drawLine({ start: { x: margin, y: dividerY }, end: { x: pageWidth - margin, y: dividerY }, thickness: 1.5, color: rgb(0.2, 0.2, 0.2) });

  const rows = [
    { label: 'Student Name', value: toLatinSafe(input.studentName) },
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
    page.drawText(r.label, { x: margin + 10, y: textY, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(r.value, { x: margin + labelColWidth + 10, y: textY, size: 11, font, color: rgb(0.1, 0.1, 0.1), maxWidth: tableWidth - labelColWidth - 20 });
  });

  const qrAreaTop = tableTop - tableHeight - 20;
  try {
    const commaIdx = input.qrCodeDataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? input.qrCodeDataUrl.slice(commaIdx + 1) : input.qrCodeDataUrl;
    const qrImg = await pdfDoc.embedPng(Uint8Array.from(Buffer.from(base64, 'base64')));
    const qrSize = 130;
    const qrX = (pageWidth - qrSize) / 2;
    const qrY = qrAreaTop - qrSize;
    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    const ql = 'Scan to verify student identity';
    page.drawText(ql, { x: (pageWidth - font.widthOfTextAtSize(ql, 9)) / 2, y: qrY - 14, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
    const fl = 'Please print this form and submit it to your professor.';
    page.drawText(fl, { x: (pageWidth - font.widthOfTextAtSize(fl, 10)) / 2, y: qrY - 34, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
  } catch {
    const fl = 'Please print this form and submit it to your professor.';
    page.drawText(fl, { x: (pageWidth - font.widthOfTextAtSize(fl, 10)) / 2, y: qrAreaTop - 20, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
  }

  return Buffer.from(await pdfDoc.save());
}
