export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';
import QRCode from 'qrcode';
import { isDoctorEmail } from '@/lib/role-rules';
import { checkRateLimit } from '@/lib/rate-limit';

function normalizeDigits(str: string): string {
  if (!str) return '';
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
}

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
  selectedSubjectIds: z.array(z.string()).optional(),
});

/** Generate a unique 5-digit numeric student code */
async function generateStudentCode(): Promise<string> {
  let code: string;
  let exists = true;
  let attempts = 0;
  do {
    code = String(Math.floor(10000 + Math.random() * 90000));
    const existing = await db.student.findUnique({ where: { studentCode: code } });
    exists = !!existing;
    attempts++;
  } while (exists && attempts < 20);
  return code;
}

/** Generate a compact QR code data URL (under 600 bytes to prevent PostgreSQL btree index overflow) */
async function generateQRCode(studentCode: string): Promise<string> {
  try {
    const url = `${process.env.QR_CODE_BASE_URL || 'http://localhost:3000'}/student/${studentCode}`;
    return await QRCode.toDataURL(url, { width: 160, margin: 1, errorCorrectionLevel: 'M' });
  } catch (e) {
    console.error('QR code generation error:', e);
    return `${process.env.QR_CODE_BASE_URL || 'http://localhost:3000'}/student/${studentCode}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
    if (!checkRateLimit(`register:${ip}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'محاولات تسجيل كثيرة. يرجى المحاولة بعد قليل.' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
    }

    // Normalize phone & studentCode digits before schema validation
    if (typeof body.studentCode === 'string') {
      body.studentCode = normalizeDigits(body.studentCode.trim());
    }
    if (typeof body.phone === 'string') {
      body.phone = normalizeDigits(body.phone.trim());
    }

    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, phone, studentCode: inputCode, departmentId, academicYear, semester, selectedSubjectIds } = result.data;
    const normalizedEmail = email.trim().toLowerCase();
    const isDoctor = isDoctorEmail(normalizedEmail);

    // Check if email already registered
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: { student: true },
    });

    if (existingUser) {
      // If user has no student profile (orphaned record), clean it up safely
      if (!existingUser.student && existingUser.role === 'STUDENT') {
        try {
          await db.notification.deleteMany({ where: { userId: existingUser.id } }).catch(() => {});
          await db.loginHistory.deleteMany({ where: { userId: existingUser.id } }).catch(() => {});
          await db.user.delete({ where: { id: existingUser.id } }).catch(() => {});
        } catch (cleanErr) {
          console.warn('Could not cleanup orphaned user:', cleanErr);
        }
      } else {
        return NextResponse.json(
          { error: 'البريد الإلكتروني مسجل بالفعل' },
          { status: 409 }
        );
      }
    }

    // Validate Student-specific fields
    let validatedDeptId = departmentId || '';
    let validatedStudentCode = '';
    let validatedQrCode = '';

    if (!isDoctor) {
      if (!departmentId) {
        return NextResponse.json({ error: 'يرجى اختيار القسم الأكاديمي' }, { status: 400 });
      }

      const dept = await db.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        return NextResponse.json({ error: 'القسم المختار غير موجود في النظام' }, { status: 400 });
      }
      validatedDeptId = dept.id;

      if (academicYear === undefined || academicYear === null || academicYear < 0 || academicYear > 5) {
        return NextResponse.json({ error: 'يرجى تحديد السنة الدراسية بشكل صحيح' }, { status: 400 });
      }

      // Handle student code
      if (inputCode && inputCode.trim()) {
        const rawCode = normalizeDigits(inputCode.trim());
        const existingStudent = await db.student.findUnique({
          where: { studentCode: rawCode },
          include: { user: { select: { id: true, status: true } } },
        });

        if (existingStudent) {
          if (existingStudent.user?.status === 'REJECTED') {
            // Safely cascade delete the rejected student
            try {
              await db.studentSubject.deleteMany({ where: { studentId: existingStudent.id } }).catch(() => {});
              await db.attendance.deleteMany({ where: { studentId: existingStudent.id } }).catch(() => {});
              await db.assignmentSubmission.deleteMany({ where: { studentId: existingStudent.id } }).catch(() => {});
              await db.student.delete({ where: { id: existingStudent.id } }).catch(() => {});
              if (existingStudent.user?.id) {
                await db.user.delete({ where: { id: existingStudent.user.id } }).catch(() => {});
              }
            } catch (err) {
              console.warn('Error deleting rejected student record:', err);
            }
            validatedStudentCode = rawCode;
          } else {
            return NextResponse.json({ error: 'كود الطالب مسجل مسبقاً في النظام' }, { status: 409 });
          }
        } else {
          validatedStudentCode = rawCode;
        }
      } else {
        validatedStudentCode = await generateStudentCode();
      }

      validatedQrCode = await generateQRCode(validatedStudentCode);
    }

    const hashedPassword = await hashPassword(password);

    // Atomic creation of user and student
    const created = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role: isDoctor ? 'DOCTOR' : 'STUDENT',
          status: isDoctor ? 'ACTIVE' : 'PENDING',
        },
      });

      if (isDoctor) {
        return { user: newUser, student: null };
      }

      const newStudent = await tx.student.create({
        data: {
          userId: newUser.id,
          studentCode: validatedStudentCode,
          qrCode: validatedQrCode,
          barcode: validatedStudentCode,
          departmentId: validatedDeptId,
          academicYear: academicYear ?? 1,
          semester: semester ?? 1,
          phone: phone ? normalizeDigits(phone.trim()) : null,
        },
      });

      // Find subjects to enroll
      let subjectIdsToEnroll: string[] = [];
      if (Array.isArray(selectedSubjectIds) && selectedSubjectIds.length > 0) {
        subjectIdsToEnroll = selectedSubjectIds;
      } else {
        const matchingSubjects = await tx.subject.findMany({
          where: {
            departmentId: validatedDeptId,
            academicYear: academicYear ?? 1,
            semester: semester ?? 1,
            isActive: true,
          },
          select: { id: true },
        });
        subjectIdsToEnroll = matchingSubjects.map(s => s.id);
      }

      if (subjectIdsToEnroll.length > 0) {
        await tx.studentSubject.createMany({
          data: subjectIdsToEnroll.map((subId) => ({
            studentId: newStudent.id,
            subjectId: subId,
          })),
          skipDuplicates: true,
        });
      }

      return { user: newUser, student: newStudent };
    });

    return NextResponse.json(
      {
        success: true,
        message: 'تم تسجيل الحساب بنجاح',
        data: {
          id: created.user.id,
          email: created.user.email,
          role: created.user.role,
          status: created.user.status,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'حدث خطأ في الخادم أثناء إنشاء الحساب. يرجى المحاولة مرة أخرى.' },
      { status: 500 }
    );
  }
}
