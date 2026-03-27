import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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

  // ── Title ──
  const title = input.title ?? 'Registration Form';
  const titleSize = 22;
  const titleWidth = fontBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (pageWidth - titleWidth) / 2,
    y: pageHeight - margin - 30,
    size: titleSize,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  const sub = 'Dr. Emad Bayoume Educational System';
  const subSize = 12;
  const subWidth = font.widthOfTextAtSize(sub, subSize);
  page.drawText(sub, {
    x: (pageWidth - subWidth) / 2,
    y: pageHeight - margin - 54,
    size: subSize,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // ── Divider 1 ──
  const divider1Y = pageHeight - margin - 72;
  page.drawLine({
    start: { x: margin, y: divider1Y },
    end: { x: pageWidth - margin, y: divider1Y },
    thickness: 1.5,
    color: rgb(0.2, 0.2, 0.2),
  });

  // ── QR Code centered between dividers ──
  const qrSize = 120;
  const qrX = (pageWidth - qrSize) / 2;
  const qrY = divider1Y - qrSize - 20;
  let qrEmbedded = false;
  try {
    const commaIdx = input.qrCodeDataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? input.qrCodeDataUrl.slice(commaIdx + 1) : input.qrCodeDataUrl;
    const qrBytes = Uint8Array.from(Buffer.from(base64, 'base64'));
    const qrImg = await pdfDoc.embedPng(qrBytes);
    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    qrEmbedded = true;
  } catch {
    // skip QR if fails
  }

  const qrLabelY = qrY - 16;
  const qrLabel = 'Scan to verify student identity';
  const qrLabelWidth = font.widthOfTextAtSize(qrLabel, 9);
  page.drawText(qrLabel, {
    x: (pageWidth - qrLabelWidth) / 2,
    y: qrLabelY,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // ── Divider 2 ──
  const divider2Y = qrLabelY - 16;
  page.drawLine({
    start: { x: margin, y: divider2Y },
    end: { x: pageWidth - margin, y: divider2Y },
    thickness: 1,
    color: rgb(0.75, 0.75, 0.75),
  });

  // ── Table ──
  const rows = [
    { label: 'Student Name', value: input.studentName },
    { label: 'Student Code', value: input.studentCode },
    { label: 'Phone', value: input.phone?.trim() || '-' },
    { label: 'Email', value: input.email },
    { label: 'Registration Date', value: input.registeredAt.toISOString().slice(0, 10) },
  ];

  const tableTop = divider2Y - 16;
  const rowHeight = 40;
  const labelColWidth = 160;
  const tableWidth = pageWidth - margin * 2;
  const tableHeight = rows.length * rowHeight;

  page.drawRectangle({
    x: margin,
    y: tableTop - tableHeight,
    width: tableWidth,
    height: tableHeight,
    borderWidth: 1,
    borderColor: rgb(0.75, 0.75, 0.75),
  });

  page.drawLine({
    start: { x: margin + labelColWidth, y: tableTop },
    end: { x: margin + labelColWidth, y: tableTop - tableHeight },
    thickness: 1,
    color: rgb(0.75, 0.75, 0.75),
  });

  rows.forEach((r, idx) => {
    const yTop = tableTop - idx * rowHeight;
    const textY = yTop - rowHeight + 13;

    if (idx > 0) {
      page.drawLine({
        start: { x: margin, y: yTop },
        end: { x: margin + tableWidth, y: yTop },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });
    }

    page.drawText(r.label, {
      x: margin + 10,
      y: textY,
      size: 11,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(r.value, {
      x: margin + labelColWidth + 10,
      y: textY,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: tableWidth - labelColWidth - 20,
    });
  });

  // ── Footer ──
  const footer = 'Please print this form and submit it to your professor.';
  const footerWidth = font.widthOfTextAtSize(footer, 10);
  page.drawText(footer, {
    x: (pageWidth - footerWidth) / 2,
    y: tableTop - tableHeight - 30,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
