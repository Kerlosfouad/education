import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import QRCode from 'qrcode';
import { z } from 'zod';

const schema = z.object({
  fullName: z.string().trim().min(1),
  departmentId: z.string().min(1),
  academicYear: z.number().min(0).max(5),
  studentCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'Student code must be exactly 5 digits'),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
  }

  const { fullName, departmentId, academicYear, studentCode, phone } = result.data;

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { student: true },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.student) return NextResponse.json({ error: 'Profile already completed' }, { status: 409 });

  const existingStudentCode = await db.student.findUnique({ where: { studentCode } });
  if (existingStudentCode) {
    if ((existingStudentCode as any).blocked) {
      return NextResponse.json({ error: 'This student code has been blocked. Please contact your instructor.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'This student code is already used' }, { status: 409 });
  }

  const qrUrl = `${process.env.QR_CODE_BASE_URL || 'http://localhost:3000'}/student/${studentCode}`;
  const qrCode = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });

  await db.student.create({
    data: {
      userId: user.id,
      studentCode,
      qrCode,
      departmentId,
      academicYear,
      phone: phone || null,
    },
  });

  // Update user name with the provided full name
  await db.user.update({
    where: { id: user.id },
    data: { name: fullName, role: 'STUDENT', status: 'PENDING' },
  });

  return NextResponse.json({ success: true });
}
