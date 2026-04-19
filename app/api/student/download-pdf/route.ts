import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateStudentQRCode } from '@/lib/codes';
import { renderToBuffer, Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import React from 'react';

export const runtime = 'nodejs';

// Register Arabic font
Font.register({
  family: 'Cairo',
  src: 'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvalIhTp2mxdt0UX8.woff2',
});

const styles = StyleSheet.create({
  page: { fontFamily: 'Cairo', backgroundColor: '#f0f4ff', padding: 30 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 24 },
  header: { backgroundColor: '#2563eb', borderRadius: 10, padding: 16, marginBottom: 20, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 10, marginTop: 4, textAlign: 'center' },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { color: '#888', fontSize: 9, fontWeight: 'bold' },
  value: { color: '#111', fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  qrSection: { alignItems: 'center', marginTop: 20, padding: 14, backgroundColor: '#f8faff', borderRadius: 10, borderWidth: 2, borderColor: '#2563eb', borderStyle: 'dashed' },
  qrLabel: { color: '#2563eb', fontSize: 9, fontWeight: 'bold', marginBottom: 8 },
  qrDesc: { color: '#888', fontSize: 8, marginTop: 6 },
  badge: { backgroundColor: '#eff6ff', color: '#2563eb', fontSize: 9, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  footer: { textAlign: 'center', marginTop: 14, color: '#aaa', fontSize: 8 },
});

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

    const rows: [string, string][] = [
      ['Full Name',     student.user.name || 'Student'],
      ['Student Code',  student.studentCode],
      ['Department',    student.department.name],
      ['Academic Year', `Level ${student.academicYear}`],
      ['Phone',         student.phone || '-'],
      ['Email',         student.user.email],
      ['Registered',    registeredAt],
    ];

    const doc = React.createElement(Document, null,
      React.createElement(Page, { size: 'A4', style: styles.page },
        React.createElement(View, { style: styles.card },
          React.createElement(View, { style: styles.header },
            React.createElement(Text, { style: styles.headerTitle }, 'Dr. Emad Bayoume Platform'),
            React.createElement(Text, { style: styles.headerSub }, 'Student Registration Card'),
          ),
          ...rows.map(([label, value]) =>
            React.createElement(View, { key: label, style: styles.row },
              React.createElement(Text, { style: styles.value }, value),
              React.createElement(Text, { style: styles.label }, label),
            )
          ),
          React.createElement(View, { style: styles.row },
            React.createElement(Text, { style: styles.badge }, 'Approved ✓'),
            React.createElement(Text, { style: styles.label }, 'Status'),
          ),
          React.createElement(View, { style: styles.qrSection },
            React.createElement(Text, { style: styles.qrLabel }, 'QR CODE'),
            React.createElement(Image, { src: qrCodeDataUrl, style: { width: 140, height: 140 } }),
            React.createElement(Text, { style: styles.qrDesc }, 'Scan to verify student identity'),
          ),
          React.createElement(Text, { style: styles.footer }, 'Please print this form and submit it to your professor.'),
        )
      )
    );

    const buffer = await renderToBuffer(doc);

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="student-${student.studentCode}.pdf"`,
      },
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed: ' + String(error) }, { status: 500 });
  }
}
