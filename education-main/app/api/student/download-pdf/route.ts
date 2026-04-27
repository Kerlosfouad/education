import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode } from '@/lib/codes';
import { escapeHtml } from '@/lib/sanitize';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      include: { user: true, department: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const qrCodeDataUrl = await generateStudentQRCode(student.id);
    const registeredAt = (student.approvedAt || student.user.createdAt).toISOString().slice(0, 10);

    const safeName = escapeHtml(student.user.name || 'Student');
    const safeCode = escapeHtml(student.studentCode);
    const safeDept = escapeHtml(student.department.name);
    const safePhone = escapeHtml(student.phone || '-');
    const safeEmail = escapeHtml(student.user.email);

    const html = `<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Registration Form - ${student.studentCode}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: #f0f4ff; padding: 30px; }
  .card { background: white; border-radius: 20px; padding: 25px; max-width: 480px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
  .header { background: #2563eb; color: white; padding: 18px; border-radius: 12px; text-align: center; margin-bottom: 20px; }
  .header h1 { font-size: 18px; margin-bottom: 4px; }
  .header p { font-size: 12px; opacity: 0.85; }
  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 11px 0; border-bottom: 1px solid #f0f0f0; }
  .info-label { color: #888; font-size: 11px; font-weight: bold; text-transform: uppercase; }
  .info-value { color: #111; font-size: 13px; font-weight: bold; text-align: right; unicode-bidi: plaintext; direction: rtl; }
  .qr-section { text-align: center; margin-top: 20px; padding: 15px; background: #f8faff; border-radius: 12px; border: 2px dashed #2563eb; }
  .qr-label { color: #2563eb; font-size: 11px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
  .qr-desc { color: #888; font-size: 10px; margin-top: 8px; }
  .badge { background: #eff6ff; color: #2563eb; padding: 3px 10px; border-radius: 20px; font-size: 11px; }
  .footer { text-align: center; margin-top: 16px; color: #aaa; font-size: 10px; }
  @media print { body { background: white; padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>Dr. Emad Bayoume Platform</h1>
    <p>Student Registration Card</p>
  </div>
  <div class="info-row"><span class="info-label">Full Name</span><span class="info-value">${safeName}</span></div>
  <div class="info-row"><span class="info-label">Student Code</span><span class="info-value">${safeCode}</span></div>
  <div class="info-row"><span class="info-label">Department</span><span class="info-value">${safeDept}</span></div>
  <div class="info-row"><span class="info-label">Academic Year</span><span class="info-value">Level ${student.academicYear}</span></div>
  <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${safePhone}</span></div>
  <div class="info-row"><span class="info-label">Email</span><span class="info-value">${safeEmail}</span></div>
  <div class="info-row"><span class="info-label">Registered</span><span class="info-value">${registeredAt}</span></div>
  <div class="info-row"><span class="info-label">Status</span><span class="badge">Approved ✓</span></div>
  <div class="qr-section">
    <div class="qr-label">QR CODE</div>
    <img src="${qrCodeDataUrl}" width="150" height="150" />
    <div class="qr-desc">Scan to verify student identity</div>
  </div>
  <div class="footer">Please print this form and submit it to your professor.</div>
</div>
<div class="no-print" style="text-align:center;margin-top:20px;">
  <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:12px 32px;border-radius:10px;font-size:15px;cursor:pointer;">🖨️ Print / Save as PDF</button>
</div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
