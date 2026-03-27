import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function decodeDataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Uint8Array.from(Buffer.from(base64, 'base64'));
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
  const page = pdfDoc.addPage([595.28, 841.89]); // A4

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  // Title
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

  // Subtitle
  const sub = 'Dr. Emad Bayoume Educational System';
  const subSize = 13;
  const subWidth = font.widthOfTextAtSize(sub, subSize);
  page.drawText(sub, {
    x: (pageWidth - subWidth) / 2,
    y: pageHeight - margin - 55,
    size: subSize,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // QR code
  const qrBytes = decodeDataUrlToBytes(input.qrCodeDataUrl);
  const qrImg = await pdfDoc.embedPng(qrBytes);
  const qrSize = 110;
  page.drawImage(qrImg, {
    x: pageWidth - margin - qrSize,
    y: pageHeight - margin - qrSize - 10,
    width: qrSize,
    height: qrSize,
  });

  // Divider
  const lineY = pageHeight - margin - 80;
  page.drawLine({
    start: { x: margin, y: lineY },
    end: { x: pageWidth - margin, y: lineY },
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

  const tableTop = lineY - 20;
  const rowHeight = 44;
  const labelColWidth = 160;
  const tableWidth = pageWidth - margin * 2;
  const tableHeight = rows.length * rowHeight;

  // Outer border
  page.drawRectangle({
    x: margin,
    y: tableTop - tableHeight,
    width: tableWidth,
    height: tableHeight,
    borderWidth: 1,
    borderColor: rgb(0.75, 0.75, 0.75),
  });

  // Vertical separator
  page.drawLine({
    start: { x: margin + labelColWidth, y: tableTop },
    end: { x: margin + labelColWidth, y: tableTop - tableHeight },
    thickness: 1,
    color: rgb(0.75, 0.75, 0.75),
  });

  rows.forEach((r, idx) => {
    const yTop = tableTop - idx * rowHeight;
    const textY = yTop - rowHeight + 14;

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

  // Footer
  const footer = 'Please print this form and submit it to your professor.';
  const footerSize = 10;
  const footerWidth = font.widthOfTextAtSize(footer, footerSize);
  page.drawText(footer, {
    x: (pageWidth - footerWidth) / 2,
    y: tableTop - tableHeight - 40,
    size: footerSize,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
