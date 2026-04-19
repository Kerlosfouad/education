'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

interface Props {
  studentCode: string;
}

export default function StudentPdfDownloader({ studentCode }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const dataRes = await fetch('/api/student/pdf-data').then(r => r.json());
      if (!dataRes.success) {
        alert('Error: ' + (dataRes.error || 'Failed to load student data'));
        setLoading(false);
        return;
      }
      const data = dataRes.data;

      // Dynamically import pdf-lib (client-side only)
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

      // ── Registration PDF ──────────────────────────────────────────
      const reg = await PDFDocument.create();
      const regPage = reg.addPage([595.28, 841.89]);
      const pw = regPage.getWidth();
      const ph = regPage.getHeight();

      const hFont = await reg.embedFont(StandardFonts.HelveticaBold);
      const rFont = await reg.embedFont(StandardFonts.Helvetica);

      // Header bg
      regPage.drawRectangle({ x: 40, y: ph - 100, width: pw - 80, height: 65, color: rgb(0.145, 0.388, 0.922) });

      // Header text
      const t1 = 'Dr. Emad Bayoume Platform';
      regPage.drawText(t1, { x: (pw - hFont.widthOfTextAtSize(t1, 16)) / 2, y: ph - 65, size: 16, font: hFont, color: rgb(1, 1, 1) });
      const t2 = 'Student Registration Card';
      regPage.drawText(t2, { x: (pw - rFont.widthOfTextAtSize(t2, 11)) / 2, y: ph - 85, size: 11, font: rFont, color: rgb(0.9, 0.9, 0.9) });

      // Rows
      const rows = [
        ['Full Name',     data.name],
        ['Student Code',  data.studentCode],
        ['Department',    data.department],
        ['Academic Year', `Level ${data.academicYear}`],
        ['Phone',         data.phone],
        ['Email',         data.email],
        ['Registered',    data.registeredAt],
        ['Status',        'Approved'],
      ];

      let y = ph - 130;
      rows.forEach(([label, value], i) => {
        if (i % 2 === 0) regPage.drawRectangle({ x: 40, y: y - 10, width: pw - 80, height: 26, color: rgb(0.97, 0.98, 0.99) });
        regPage.drawText(label.toUpperCase(), { x: 52, y: y + 2, size: 9, font: hFont, color: rgb(0.53, 0.53, 0.53) });
        // Right-align value
        const vw = rFont.widthOfTextAtSize(String(value), 11);
        regPage.drawText(String(value), { x: pw - 52 - vw, y: y + 2, size: 11, font: rFont, color: rgb(0.07, 0.07, 0.07) });
        regPage.drawLine({ start: { x: 40, y: y - 10 }, end: { x: pw - 40, y: y - 10 }, thickness: 0.5, color: rgb(0.94, 0.94, 0.94) });
        y -= 28;
      });

      // QR
      try {
        const commaIdx = data.qrCodeDataUrl.indexOf(',');
        const b64 = commaIdx >= 0 ? data.qrCodeDataUrl.slice(commaIdx + 1) : data.qrCodeDataUrl;
        const qrBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const qrImg = await reg.embedPng(qrBytes);
        const qrSize = 130;
        const qrX = (pw - qrSize) / 2;
        const qrY = y - qrSize - 10;
        regPage.drawRectangle({ x: qrX - 15, y: qrY - 15, width: qrSize + 30, height: qrSize + 40, color: rgb(0.97, 0.98, 1) });
        regPage.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
        const ql = 'Scan to verify student identity';
        regPage.drawText(ql, { x: (pw - rFont.widthOfTextAtSize(ql, 9)) / 2, y: qrY - 12, size: 9, font: rFont, color: rgb(0.53, 0.53, 0.53) });
      } catch {}

      const regBytes = await reg.save();
      downloadBlob(new Blob([regBytes.buffer as ArrayBuffer], { type: 'application/pdf' }), `registration-${studentCode}.pdf`);

      await new Promise(r => setTimeout(r, 500));

      // ── Cards PDF ─────────────────────────────────────────────────
      const cards = await PDFDocument.create();
      const cFont = await cards.embedFont(StandardFonts.HelveticaBold);
      const cFontR = await cards.embedFont(StandardFonts.Helvetica);

      const cpw = 595.28;
      const cols = 3, cardRows = 2;
      const mx = 28, my = 45;
      const cw = (cpw - mx * 2 - (cols - 1) * 10) / cols;
      const ch = 195;
      const totalH = cardRows * ch + (cardRows - 1) * 10;
      const cph = my + 22 + totalH + my;

      const cardsPage = cards.addPage([cpw, cph]);

      // Title
      const ct = '6 Attendance Cards';
      cardsPage.drawText(ct, { x: (cpw - cFont.widthOfTextAtSize(ct, 12)) / 2, y: cph - 18, size: 12, font: cFont, color: rgb(0.2, 0.2, 0.2) });

      // Embed QR once
      let qrImg = null;
      try {
        const commaIdx = data.qrCodeDataUrl.indexOf(',');
        const b64 = commaIdx >= 0 ? data.qrCodeDataUrl.slice(commaIdx + 1) : data.qrCodeDataUrl;
        const qrBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        qrImg = await cards.embedPng(qrBytes);
      } catch {}

      for (let r = 0; r < cardRows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = mx + c * (cw + 10);
          const cy = cph - my - 22 - (r + 1) * ch - r * 10;

          // Card border
          cardsPage.drawRectangle({ x: cx, y: cy, width: cw, height: ch, borderWidth: 1, borderColor: rgb(0.75, 0.75, 0.75), color: rgb(1, 1, 1) });

          // Header
          cardsPage.drawRectangle({ x: cx, y: cy + ch - 34, width: cw, height: 34, color: rgb(0.92, 0.92, 0.92) });
          const ht = 'Attendance Card';
          cardsPage.drawText(ht, { x: cx + (cw - cFont.widthOfTextAtSize(ht, 9)) / 2, y: cy + ch - 16, size: 9, font: cFont, color: rgb(0.1, 0.1, 0.1) });
          const st = 'Dr. Emad Bayoume';
          cardsPage.drawText(st, { x: cx + (cw - cFontR.widthOfTextAtSize(st, 7)) / 2, y: cy + ch - 28, size: 7, font: cFontR, color: rgb(0.3, 0.3, 0.3) });

          // Name
          const nameY = cy + ch - 48;
          cardsPage.drawText('Name', { x: cx + 6, y: nameY, size: 7, font: cFont, color: rgb(0.5, 0.5, 0.5) });
          const nameVal = data.name.length > 20 ? data.name.slice(0, 20) + '…' : data.name;
          const nw = cFontR.widthOfTextAtSize(nameVal, 8);
          cardsPage.drawText(nameVal, { x: cx + cw - 6 - nw, y: nameY, size: 8, font: cFontR, color: rgb(0.1, 0.1, 0.1) });
          cardsPage.drawLine({ start: { x: cx + 6, y: nameY - 4 }, end: { x: cx + cw - 6, y: nameY - 4 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });

          // ID
          const idY = nameY - 16;
          cardsPage.drawText('ID', { x: cx + 6, y: idY, size: 7, font: cFont, color: rgb(0.5, 0.5, 0.5) });
          const idw = cFont.widthOfTextAtSize(data.studentCode, 8);
          cardsPage.drawText(data.studentCode, { x: cx + cw - 6 - idw, y: idY, size: 8, font: cFont, color: rgb(0.1, 0.1, 0.1) });
          cardsPage.drawLine({ start: { x: cx + 6, y: idY - 4 }, end: { x: cx + cw - 6, y: idY - 4 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });

          // QR
          if (qrImg) {
            const qrSize = cw - 16;
            cardsPage.drawImage(qrImg, { x: cx + 8, y: idY - 8 - qrSize, width: qrSize, height: qrSize });
          }
        }
      }

      const footer = 'Submit one card per lecture to complete attendance registration';
      cardsPage.drawText(footer, { x: (cpw - cFontR.widthOfTextAtSize(footer, 7)) / 2, y: 12, size: 7, font: cFontR, color: rgb(0.5, 0.5, 0.5) });

      const cardsBytes = await cards.save();
      downloadBlob(new Blob([cardsBytes.buffer as ArrayBuffer], { type: 'application/pdf' }), `cards-${studentCode}.pdf`);

    } catch (e) {
      alert('Download failed: ' + String(e));
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="mt-2 flex items-center gap-2 w-full justify-center py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
    >
      {loading
        ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Downloading...</>
        : <><Download size={16} /> Download Data</>
      }
    </button>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
