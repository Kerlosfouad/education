import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode } from '@/lib/codes';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      include: { user: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const qrDataUrl = await generateStudentQRCode(student.id);
    const name = student.user.name || 'Student';
    const code = student.studentCode;

    const card = `
      <div style="background:white;border:1px solid #ddd;border-radius:10px;overflow:hidden;">
        <div style="background:#eee;padding:8px;text-align:center;">
          <div style="font-size:11px;font-weight:bold;color:#222;">Attendance Card</div>
          <div style="font-size:9px;color:#555;margin-top:2px;">Dr. Emad Bayoume</div>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:9px;font-weight:bold;color:#888;">Name</span>
          <span style="font-size:10px;font-weight:bold;color:#111;direction:rtl;unicode-bidi:plaintext;max-width:70%;text-align:right;">${name}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:9px;font-weight:bold;color:#888;">ID</span>
          <span style="font-size:10px;font-weight:bold;color:#111;">${code}</span>
        </div>
        <div style="text-align:center;padding:8px;">
          <img src="${qrDataUrl}" width="110" height="110" />
        </div>
      </div>`;

    const cards = Array(6).fill(card).join('');

    const html = `<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<title>Attendance Cards - ${code}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
  h2 { text-align: center; margin-bottom: 16px; font-size: 16px; font-weight: bold; color: #333; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; max-width: 700px; margin: 0 auto; }
  .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #aaa; }
  @media print { body { background: white; padding: 0; } .no-print { display: none; } .grid { max-width: 100%; } }
</style>
</head>
<body>
<h2>6 Attendance Cards</h2>
<div class="grid">${cards}</div>
<div class="footer">Submit one card per lecture to complete attendance registration</div>
<div class="no-print" style="text-align:center;margin-top:20px;">
  <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:12px 32px;border-radius:10px;font-size:15px;cursor:pointer;">🖨️ Print / Save as PDF</button>
</div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed: ' + String(error) }, { status: 500 });
  }
}
