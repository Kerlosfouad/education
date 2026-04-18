import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET: list all announcements (stored as system_config)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = await db.systemConfig.findUnique({ where: { key: 'announcements' } });
  const announcements = (config?.value as any[]) || [];
  return NextResponse.json({ success: true, data: announcements });
}

// POST: create announcement + notify students
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, message, imageUrl, departmentId, academicYear } = await req.json();
  if (!title || !message) return NextResponse.json({ error: 'Title and message required' }, { status: 400 });

  const id = `ann_${Date.now()}`;
  const newAnn = { id, title, message, imageUrl: imageUrl || null, departmentId: departmentId || null, academicYear: academicYear || null, createdAt: new Date().toISOString() };

  // Save to system_config as JSON array
  const existing = await db.systemConfig.findUnique({ where: { key: 'announcements' } });
  const list = existing ? [(newAnn), ...(existing.value as any[])] : [newAnn];
  await db.systemConfig.upsert({
    where: { key: 'announcements' },
    update: { value: list, updatedBy: session.user.id },
    create: { key: 'announcements', value: list, updatedBy: session.user.id },
  });

  return NextResponse.json({ success: true, data: newAnn });
}

// PATCH: update announcement by id
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, title, message, imageUrl, departmentId, academicYear, targetPage } = await req.json();
  const existing = await db.systemConfig.findUnique({ where: { key: 'announcements' } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const list = (existing.value as any[]).map(a =>
    a.id === id ? { ...a, title, message, imageUrl: imageUrl || null, departmentId: departmentId || null, academicYear: academicYear || null, targetPage: targetPage || null } : a
  );
  await db.systemConfig.update({ where: { key: 'announcements' }, data: { value: list } });
  return NextResponse.json({ success: true });
}

// DELETE: remove announcement by id
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  const existing = await db.systemConfig.findUnique({ where: { key: 'announcements' } });
  if (!existing) return NextResponse.json({ success: true });

  const list = (existing.value as any[]).filter(a => a.id !== id);
  await db.systemConfig.update({ where: { key: 'announcements' }, data: { value: list } });
  return NextResponse.json({ success: true });
}
