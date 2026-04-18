'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

interface Props {
  studentCode: string;
}

export default function StudentPdfDownloader({ studentCode }: Props) {
  const [loading, setLoading] = useState(false);

  const generateRegistrationPdf = async (data: any, jsPDF: any, html2canvas: any) => {
    // Create hidden div with HTML content
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-9999px;top:0;width:480px;background:white;padding:30px;font-family:Arial,sans-serif;';
    div.innerHTML = `
      <div style="background:white;border-radius:20px;padding:25px;max-width:480px;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
        <div style="background:#2563eb;color:white;padding:18px;border-radius:12px;text-align:center;margin-bottom:20px;">
          <div style="font-size:18px;font-weight:bold;margin-bottom:4px;">Dr. Emad Bayoume Platform</div>
          <div style="font-size:12px;opacity:0.85;">Student Registration Card</div>
        </div>
        ${[
          ['Full Name', data.name],
          ['Student Code', data.studentCode],
          ['Department', data.department],
          ['Academic Year', `Level ${data.academicYear}`],
          ['Phone', data.phone],
          ['Email', data.email],
          ['Registered', data.registeredAt],
          ['Status', '<span style="background:#eff6ff;color:#2563eb;padding:3px 10px;border-radius:20px;font-size:11px;">Approved ✓</span>'],
        ].map(([label, value]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #f0f0f0;">
            <span style="color:#888;font-size:11px;font-weight:bold;text-transform:uppercase;">${label}</span>
            <span style="color:#111;font-size:13px;font-weight:bold;text-align:right;direction:rtl;unicode-bidi:plaintext;">${value}</span>
          </div>`).join('')}
        <div style="text-align:center;margin-top:20px;padding:15px;background:#f8faff;border-radius:12px;border:2px dashed #2563eb;">
          <div style="color:#2563eb;font-size:11px;font-weight:bold;margin-bottom:10px;letter-spacing:1px;">QR CODE</div>
          <img src="${data.qrCodeDataUrl}" width="150" height="150" />
          <div style="color:#888;font-size:10px;margin-top:8px;">Scan to verify student identity</div>
        </div>
        <div style="text-align:center;margin-top:12px;color:#aaa;font-size:10px;">Please print this form and submit it to your professor.</div>
      </div>`;
    document.body.appendChild(div);

    const canvas = await html2canvas(div, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    document.body.removeChild(div);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
    pdf.save(`registration-${studentCode}.pdf`);
  };

  const generateCardsPdf = async (data: any, jsPDF: any, html2canvas: any) => {
    const cards = Array(6).fill(null).map(() => `
      <div style="background:white;border:1px solid #ddd;border-radius:10px;overflow:hidden;width:170px;">
        <div style="background:#eee;padding:8px;text-align:center;">
          <div style="font-size:11px;font-weight:bold;color:#222;">Attendance Card</div>
          <div style="font-size:9px;color:#555;margin-top:2px;">Dr. Emad Bayoume</div>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:9px;font-weight:bold;color:#888;">Name</span>
          <span style="font-size:10px;font-weight:bold;color:#111;direction:rtl;unicode-bidi:plaintext;max-width:110px;text-align:right;">${data.name}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:9px;font-weight:bold;color:#888;">ID</span>
          <span style="font-size:10px;font-weight:bold;color:#111;">${data.studentCode}</span>
        </div>
        <div style="text-align:center;padding:8px;">
          <img src="${data.qrCodeDataUrl}" width="110" height="110" />
        </div>
      </div>`).join('');

    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-9999px;top:0;width:600px;background:#f5f5f5;padding:20px;font-family:Arial,sans-serif;';
    div.innerHTML = `
      <div style="text-align:center;margin-bottom:16px;font-size:16px;font-weight:bold;color:#333;">6 Attendance Cards</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">${cards}</div>
      <div style="text-align:center;margin-top:16px;font-size:10px;color:#aaa;">Submit one card per lecture to complete attendance registration</div>`;
    document.body.appendChild(div);

    const canvas = await html2canvas(div, { scale: 2, useCORS: true, backgroundColor: '#f5f5f5' });
    document.body.removeChild(div);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
    pdf.save(`cards-${studentCode}.pdf`);
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const [dataRes, jsPDFModule, html2canvas] = await Promise.all([
        fetch('/api/student/pdf-data').then(r => r.json()),
        import('jspdf'),
        import('html2canvas').then(m => m.default),
      ]);
      const jsPDF = jsPDFModule.jsPDF;

      if (!dataRes.success) {
        alert('Error: ' + (dataRes.error || 'Failed to load student data'));
        setLoading(false);
        return;
      }

      await generateRegistrationPdf(dataRes.data, jsPDF, html2canvas);
      await new Promise(r => setTimeout(r, 500));
      await generateCardsPdf(dataRes.data, jsPDF, html2canvas);
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
