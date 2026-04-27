import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
  const font    = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const W = page.getWidth(), H = page.getHeight();

  const drawC = (text: string, y: number, size: number, bold = false, color = rgb(0.1,0.1,0.1)) => {
    const f = bold ? fontBold : font;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (W - w) / 2, y, size, font: f, color });
  };

  drawC(input.title ?? 'Registration Form', H - margin - 30, 22, true);
  drawC('Dr. Emad Bayoume Educational System', H - margin - 54, 12, false, rgb(0.4,0.4,0.4));

  const divY = H - margin - 72;
  page.drawLine({ start: { x: margin, y: divY }, end: { x: W - margin, y: divY }, thickness: 1.5, color: rgb(0.2,0.2,0.2) });

  const rows = [
    { label: 'Student Name', value: toLatinSafe(input.studentName) },
    { label: 'Student Code', value: input.studentCode },
    { label: 'Phone',        value: input.phone?.trim() || '-' },
    { label: 'Email',        value: input.email },
    { label: 'Registered',   value: input.registeredAt.toISOString().slice(0, 10) },
  ];

  const tTop = divY - 20, rH = 40, lblW = 160;
  const tW = W - margin * 2, tH = rows.length * rH;

  page.drawRectangle({ x: margin, y: tTop - tH, width: tW, height: tH, borderWidth: 1, borderColor: rgb(0.75,0.75,0.75) });
  page.drawLine({ start: { x: margin + lblW, y: tTop }, end: { x: margin + lblW, y: tTop - tH }, thickness: 1, color: rgb(0.75,0.75,0.75) });

  rows.forEach((r, i) => {
    const yTop = tTop - i * rH, textY = yTop - rH + 13;
    if (i > 0) page.drawLine({ start: { x: margin, y: yTop }, end: { x: margin + tW, y: yTop }, thickness: 0.5, color: rgb(0.85,0.85,0.85) });
    page.drawText(r.label, { x: margin + 10, y: textY, size: 11, font: fontBold, color: rgb(0.2,0.2,0.2) });
    page.drawText(r.value, { x: margin + lblW + 10, y: textY, size: 11, font, color: rgb(0.1,0.1,0.1), maxWidth: tW - lblW - 20 });
  });

  const qrTop = tTop - tH - 20;
  try {
    const b64 = input.qrCodeDataUrl.includes(',') ? input.qrCodeDataUrl.split(',')[1] : input.qrCodeDataUrl;
    const qrImg = await pdfDoc.embedPng(Uint8Array.from(Buffer.from(b64, 'base64')));
    const qrSize = 130, qrX = (W - qrSize) / 2, qrY = qrTop - qrSize;
    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    drawC('Scan to verify student identity', qrY - 14, 9, false, rgb(0.5,0.5,0.5));
    drawC('Please print this form and submit it to your professor.', qrY - 34, 10, false, rgb(0.5,0.5,0.5));
  } catch {
    drawC('Please print this form and submit it to your professor.', qrTop - 20, 10, false, rgb(0.5,0.5,0.5));
  }

  return Buffer.from(await pdfDoc.save());
}
