import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { name, email, password, phone, departmentId, academicYear } = await req.json();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    const hashed = await hashPassword(password);
    const user = await db.user.create({ data: { name, email, password: hashed, role: 'STUDENT', status: 'PENDING' } });
    const code = `STU${new Date().getFullYear().toString().slice(-2)}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await db.student.create({ data: { userId: user.id, studentCode: code, departmentId, academicYear: parseInt(academicYear) || academicYear, phone } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 500 });
  }
}
