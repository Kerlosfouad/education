import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode } from '@/lib/codes';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

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

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>Registration Form</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo', Arial, sans-serif; background: #f0f4ff; padding: 30px; direction: rtl; }
  .card { background: white; border-radius: 20px; padding: 25px; max-width: 480px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
  .header { background: #2563eb; color: white; padding: 18px; border-radius: 12px; text-align: center; margin-bottom: 20px; }
  .header h1 { font-size: 18px; margin-bottom: 4px; font-weight: 900; }
  .header p { font-size: 12px; opacity: 0.85; }
  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 11px 0; border-bottom: 1px solid #f0f0f0; }
  .info-label { color: #888; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .info-value { color: #111; font-size: 13px; font-weight: 700; text-align: right; }
  .qr-section { text-align: center; margin-top: 20px; padding: 15px; background: #f8faff; border-radius: 12px; border: 2px dashed #2563eb; }
  .qr-label { color: #2563eb; font-size: 11px; font-weight: 700; margin-bottom: 10px; letter-spacing: 1px; }
  .qr-desc { color: #888; font-size: 10px; margin-top: 8px; }
  .badge { background: #eff6ff; color: #2563eb; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .footer { text-align: center; margin-top: 16px; color: #aaa; font-size: 10px; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>Dr. Emad Bayoume Platform</h1>
    <p>Student Registration Card</p>
  </div>
  <div class="info-row">
    <span class="info-value">${student.user.name || 'Student'}</span>
    <span class="info-label">Full Name</span>
  </div>
  <div class="info-row">
    <span class="info-value">${student.studentCode}</span>
    <span class="info-label">Student Code</span>
  </div>
  <div class="info-row">
    <span class="info-value">${student.department.name}</span>
    <span class="info-label">Department</span>
  </div>
  <div class="info-row">
    <span class="info-value">Level ${student.academicYear}</span>
    <span class="info-label">Academic Year</span>
  </div>
  <div class="info-row">
    <span class="info-value">${student.phone || '-'}</span>
    <span class="info-label">Phone</span>
  </div>
  <div class="info-row">
    <span class="info-value">${student.user.email}</span>
    <span class="info-label">Email</span>
  </div>
  <div class="info-row">
    <span class="info-value">${registeredAt}</span>
    <span class="info-label">Registered</span>
  </div>
  <div class="info-row">
    <span class="badge">Approved ✓</span>
    <span class="info-label">Status</span>
  </div>
  <div class="qr-section">
    <div class="qr-label">QR CODE</div>
    <img src="${qrCodeDataUrl}" width="150" height="150" />
    <div class="qr-desc">Scan to verify student identity</div>
  </div>
  <div class="footer">Please print this form and submit it to your professor.</div>
</div>
</body>
</html>`;

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    });

    await browser.close();

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="student-${student.studentCode}.pdf"`,
      },
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed: ' + String(error) }, { status: 500 });
  }
}
