import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';
import QRCode from 'qrcode';
import { isDoctorEmail } from '@/lib/role-rules';
import { checkRateLimit } from '@/lib/rate-limit';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').refine(
    (val) => val.trim().split(/\s+/).length >= 2,
    { message: 'Please enter at least two names (e.g. John Smith)' }
  ),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  studentCode: z.string().optional(),
  departmentId: z.string().optional(),
  academicYear: z.number().optional(),
  semester: z.number().min(1).max(2).optional(),
});

/** Generate a unique 6-digit numeric student code */
async function generateStudentCode(): Promise<string> {
  let code: string;
  let exists = true;
  do {
    code = String(Math.floor(10000 + Math.random() * 90000));
    const existing = await db.student.findUnique({ where: { studentCode: code } });
    exists = !!existing;
  } while (exists);
  return code;
}

/** Generate a QR code data URL for the given student code */
async function generateQRCode(studentCode: string): Promise<string> {
  const url = `${process.env.QR_CODE_BASE_URL || 'http://localhost:3000'}/student/${studentCode}`;
  return QRCode.toDataURL(url, { width: 300, margin: 2 });
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
    if (!checkRateLimit(`register:${ip}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many registration attempts. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();

    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, phone, studentCode: inputCode, departmentId, academicYear, semester } = result.data;
    const normalizedEmail = email.toLowerCase();
    const isDoctor = isDoctorEmail(normalizedEmail);

    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: isDoctor ? 'DOCTOR' : 'STUDENT',
        status: isDoctor ? 'ACTIVE' : 'PENDING',
      },
    });

    if (!isDoctor) {
      if (!departmentId) {
        return NextResponse.json({ error: 'Department is required' }, { status: 400 });
      }
      if (academicYear === undefined || academicYear === null || academicYear < 0 || academicYear > 5) {
        return NextResponse.json({ error: 'Academic year must be between 0 and 5' }, { status: 400 });
      }

      // Use provided code or generate one
      let studentCode: string;
      if (inputCode && inputCode.trim()) {
        const existing = await db.student.findUnique({ where: { studentCode: inputCode.trim() } });
        if (existing) {
          await db.user.delete({ where: { id: user.id } });
          return NextResponse.json({ error: 'Student code already in use' }, { status: 409 });
        }
        studentCode = inputCode.trim();
      } else {
        studentCode = await generateStudentCode();
      }
      const qrCode = await generateQRCode(studentCode);

      await db.student.create({
        data: {
          userId: user.id,
          studentCode,
          qrCode,
          departmentId,
          academicYear,
          semester: semester ?? 1,
          phone: phone || null,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful',
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
