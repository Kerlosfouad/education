import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import QRCode from 'qrcode';
import { z } from 'zod';

const schema = z.object({
  fullName: z.string().trim().min(1).refine(
    (val) => val.trim().split(/\s+/).length >= 2,
    { message: 'Please enter at least two names (e.g. John Smith)' }
  ),
  departmentId: z.string().min(1),
  academicYear: z.number().min(0).max(5),
  studentCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'Student code must be exactly 5 digits'),
  phone: z.string().optional(),
  semester: z.number().min(1).max(2).optional(),
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

  const { fullName, departmentId, academicYear, studentCode, phone, semester } = result.data;

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { student: true },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.student) return NextResponse.json({ error: 'Profile already completed' }, { status: 409 });

  // Only check active/pending students - ignore rejected ones
  const existingStudentCode = await db.student.findFirst({
    where: {
      studentCode,
      user: { status: { in: ['ACTIVE', 'PENDING'] } },
    },
  });
  if (existingStudentCode) {
    return NextResponse.json({ error: 'This student code is already used' }, { status: 409 });
  }

  // If a rejected student had this code, clear it first
  await db.$executeRaw`
    UPDATE students SET "studentCode" = CONCAT('DUP_', SUBSTRING(id, 1, 8))
    WHERE "studentCode" = ${studentCode}
  `;

  const qrUrl = `${process.env.QR_CODE_BASE_URL || 'http://localhost:3000'}/student/${studentCode}`;
  const qrCode = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });

  const newStudent = await db.student.create({
    data: {
      userId: user.id,
      studentCode,
      qrCode,
      departmentId,
      academicYear,
      phone: phone || null,
    } as any,
  });

  // Update semester separately since it may not be in generated types yet
  await db.$executeRaw`UPDATE students SET semester = ${semester ?? 1} WHERE id = ${newStudent.id}`;

  // Update user name with the provided full name
  await db.user.update({
    where: { id: user.id },
    data: { name: fullName, role: 'STUDENT', status: 'PENDING' },
  });

  return NextResponse.json({ success: true });
}
