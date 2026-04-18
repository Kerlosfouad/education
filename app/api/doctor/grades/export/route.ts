import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import ExcelJS from 'exceljs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['DOCTOR', 'ADMIN'].includes(session.user.role))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subjectId, examTypes, students, subjectName } = await req.json();

  const wb = new ExcelJS.Workbook();

  const buildSheet = (list: any[], sheetName: string, subjName: string) => {
    const ws = wb.addWorksheet(sheetName.slice(0, 31));
    const colCount = 3 + examTypes.length + 1; // #, Name, Code, ...exams, Total

    // Row 1: Title
    ws.mergeCells(1, 1, 1, colCount);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = `Grade Sheet - ${subjName}`;
    titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    // Row 2: empty
    ws.addRow([]);

    // Row 3: Headers
    const headers = ['#', 'Student Name', 'Code', ...examTypes.map((t: any) => `${t.label} (/${t.max})`), 'Total'];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E4DA0' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF1a3a8a' } } };
    });
    ws.getRow(3).height = 22;

    // Data rows
    list.forEach((s: any, i: number) => {
      const total = examTypes.reduce((sum: number, t: any) => sum + (s.grades[t.key] ?? 0), 0);
      const maxTotal = examTypes.reduce((sum: number, t: any) => sum + t.max, 0);
      const graded = examTypes.some((t: any) => s.grades[t.key] !== undefined);
      const row = ws.addRow([
        i + 1, s.name, s.studentCode,
        ...examTypes.map((t: any) => s.grades[t.key] ?? 0),
        `${graded ? total : 0} / ${maxTotal}`,
      ]);
      // Style total cell
      const totalCell = row.getCell(colCount);
      totalCell.font = { bold: true, color: { argb: graded ? 'FF00A651' : 'FF999999' } };
      totalCell.alignment = { horizontal: 'center' };
      // Center all cells
      row.eachCell((cell, colNum) => {
        cell.alignment = { horizontal: colNum === 2 ? 'left' : 'center' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });
    });

    // Empty row
    ws.addRow([]);

    // Total students row
    const totalRow = ws.addRow([...Array(colCount - 2).fill(''), `Total Students: ${list.length}`, '']);
    ws.mergeCells(totalRow.number, colCount - 1, totalRow.number, colCount);
    const totalStudentsCell = totalRow.getCell(colCount - 1);
    totalStudentsCell.font = { bold: true };
    totalStudentsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
    totalStudentsCell.alignment = { horizontal: 'right' };

    // Column widths
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 28;
    ws.getColumn(3).width = 12;
    examTypes.forEach((_: any, i: number) => { ws.getColumn(4 + i).width = 16; });
    ws.getColumn(colCount).width = 14;
  };

  if (subjectId === 'all') {
    // Group students by subject
    const grouped: Record<string, any[]> = {};
    students.forEach((s: any) => {
      const key = s.subjectId || 'general';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });
    Object.entries(grouped).forEach(([subjId, list]) => {
      const name = list[0]?.subjectName || subjId;
      buildSheet(list, name.slice(0, 31), name);
    });
  } else {
    buildSheet(students, subjectName?.slice(0, 31) || 'Grades', subjectName || 'Grades');
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="grades-${Date.now()}.xlsx"`,
    },
  });
}
