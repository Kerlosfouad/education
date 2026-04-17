'use client';

import { useState, useEffect } from 'react';
import { GraduationCap, Download, Loader2, Check, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';

interface Subject { id: string; name: string; code: string; department: { name: string }; academicYear: number; semester: number; }
interface StudentGrade { id: string; name: string; studentCode: string; grades: Record<string, number>; subjectId?: string; subjectName?: string; }

const DEFAULT_EXAM_TYPES = [
  { key: 'MIDTERM', label: 'Midterm', max: 20 },
  { key: 'FINAL',   label: 'Final',   max: 50 },
  { key: 'QUIZ',    label: 'Quiz',    max: 20 },
  { key: 'PROJECT', label: 'Project', max: 10 },
];

export default function GradesPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [students, setStudents] = useState<StudentGrade[]>([]);
  const [subjectInfo, setSubjectInfo] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentGrade | null>(null);
  const [editGrades, setEditGrades] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [examMaxes, setExamMaxes] = useState<Record<string, number>>(() =>
    Object.fromEntries(DEFAULT_EXAM_TYPES.map(t => [t.key, t.max]))
  );
  const [editingMax, setEditingMax] = useState<string | null>(null);
  const [tempMax, setTempMax] = useState('');

  const examTypes = DEFAULT_EXAM_TYPES.map(t => ({ ...t, max: examMaxes[t.key] }));
  const maxTotal = examTypes.reduce((s, t) => s + t.max, 0);

  useEffect(() => {
    fetch('/api/doctor/subjects')
      .then(r => r.json())
      .then(j => { if (j.success) setSubjects(j.subjects); });
  }, []);

  // Auto-load on mount with 'all'
  useEffect(() => {
    loadStudents('all');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStudents = async (subjectId: string) => {
    setLoading(true);
    setStudents([]);
    setSubjectInfo(null);
    if (subjectId === 'all') {
      const res = await fetch('/api/doctor/subjects');
      const json = await res.json();
      if (!json.success) { setLoading(false); return; }
      const allStudents: StudentGrade[] = [];
      for (const subj of json.subjects) {
        const r = await fetch(`/api/doctor/grades?subjectId=${subj.id}`);
        const d = await r.json();
        if (d.success) d.students.forEach((s: StudentGrade) =>
          allStudents.push({ ...s, subjectId: subj.id, subjectName: subj.name })
        );
      }
      setStudents(allStudents);
    } else {
      const res = await fetch(`/api/doctor/grades?subjectId=${subjectId}`);
      const json = await res.json();
      if (json.success) { setStudents(json.students); setSubjectInfo(json.subject); }
    }
    setLoading(false);
  };

  const openEdit = (s: StudentGrade) => {
    setEditingStudent(s);
    const init: Record<string, string> = {};
    examTypes.forEach(t => { init[t.key] = s.grades[t.key] !== undefined ? String(s.grades[t.key]) : ''; });
    setEditGrades(init);
  };

  const handleSave = async () => {
    if (!editingStudent) return;
    const subjectId = editingStudent.subjectId || selectedSubject;
    if (!subjectId || subjectId === 'all') { toast.error('Cannot save without a subject'); return; }
    setSaving(true);
    try {
      for (const t of examTypes) {
        const val = editGrades[t.key];
        if (val === '' || val === undefined) continue;
        const score = Number(val);
        if (isNaN(score)) continue;
        await fetch('/api/doctor/grades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId, studentId: editingStudent.id, examType: t.key, score, maxScore: t.max }),
        });
      }
      toast.success('Grades saved');
      setEditingStudent(null);
      loadStudents(selectedSubject);
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const getTotal = (grades: Record<string, number>) => examTypes.reduce((sum, t) => sum + (grades[t.key] ?? 0), 0);
  const hasGrades = (s: StudentGrade) => examTypes.some(t => s.grades[t.key] !== undefined);

  const exportExcel = () => {
    if (!students.length) return;
    const name = subjectInfo?.name || 'All Subjects';
    const wb = XLSX.utils.book_new();

    const exportSubject = (list: StudentGrade[], sheetName: string, subjName: string) => {
      const headers = ['#', 'Student Name', 'Code', ...examTypes.map(t => `${t.label} (/${t.max})`), 'Total'];
      const colCount = headers.length;

      const aoa: any[][] = [
        [{ v: `Grade Sheet - ${subjName}`, s: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center' } } }, ...Array(colCount - 1).fill({ v: '', s: { fill: { fgColor: { rgb: '1F3864' } } } })],
        Array(colCount).fill({ v: '' }),
        headers.map(h => ({ v: h, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2E4DA0' } }, alignment: { horizontal: 'center' } } })),
        ...list.map((s, i) => {
          const total = getTotal(s.grades);
          const graded = hasGrades(s);
          const rowStyle = { alignment: { horizontal: 'center' }, border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } } };
          return [
            { v: i + 1, s: rowStyle },
            { v: s.name, s: { ...rowStyle, alignment: { horizontal: 'left' } } },
            { v: s.studentCode, s: rowStyle },
            ...examTypes.map(t => ({ v: s.grades[t.key] ?? 0, s: rowStyle })),
            { v: graded ? `${total} / ${maxTotal}` : `0 / ${maxTotal}`, s: { font: { bold: true, color: { rgb: graded ? '00A651' : '999999' } }, alignment: { horizontal: 'center' } } },
          ];
        }),
        Array(colCount).fill({ v: '' }),
        [...Array(colCount - 2).fill({ v: '' }), { v: `Total Students: ${list.length}`, s: { font: { bold: true }, fill: { fgColor: { rgb: 'EEF2FF' } }, alignment: { horizontal: 'right' } } }, { v: '', s: { fill: { fgColor: { rgb: 'EEF2FF' } } } }],
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }];
      ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 10 }, ...examTypes.map(() => ({ wch: 14 })), { wch: 12 }];
      ws['!rows'] = [{ hpt: 30 }, {}, { hpt: 22 }];
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    };

    if (selectedSubject === 'all') {
      subjects.forEach(subj => {
        const list = students.filter(s => s.subjectId === subj.id);
        if (list.length > 0) exportSubject(list, subj.name.slice(0, 31), subj.name);
      });
    } else {
      exportSubject(students, name.slice(0, 31), name);
    }
    XLSX.writeFile(wb, `grades-${name}-${Date.now()}.xlsx`);
  };

  // Reusable student table
  const StudentTable = ({ list, subjId }: { list: StudentGrade[]; subjId?: string }) => (
    <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
      {list.map(s => {
        const total = getTotal(s.grades);
        const graded = hasGrades(s);
        return (
          <div key={`${s.id}-${subjId}`} className={`grid grid-cols-[2fr_1fr_repeat(4,1fr)_1fr_auto] gap-2 items-center px-6 py-4 transition-colors ${graded ? 'bg-green-50/30 dark:bg-green-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/20'}`}>
            <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{s.name}</span>
            <span className="text-xs text-slate-400">{s.studentCode}</span>
            {examTypes.map(t => (
              <span key={t.key} className={`text-sm font-bold ${s.grades[t.key] !== undefined ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300'}`}>
                {s.grades[t.key] !== undefined ? s.grades[t.key] : '—'}
              </span>
            ))}
            <span className={`text-sm font-black ${graded ? 'text-green-600' : 'text-slate-300'}`}>
              {graded ? `${total}/${maxTotal}` : '—'}
            </span>
            <button onClick={() => openEdit(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${graded ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
              {graded ? <><Pencil size={12} /> Edit</> : <><Check size={12} /> Set</>}
            </button>
          </div>
        );
      })}
    </div>
  );

  const TableHeader = () => (
    <div className="grid grid-cols-[2fr_1fr_repeat(4,1fr)_1fr_auto] gap-2 px-6 py-3 bg-slate-50 dark:bg-slate-700/30 text-xs font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
      <span>Student</span><span>Code</span>
      {examTypes.map(t => <span key={t.key}>{t.label}</span>)}
      <span>Total</span><span></span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="text-indigo-600" size={28} />
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">Grades</h2>
            <p className="text-slate-500 text-sm mt-0.5">Set and manage student grades by subject</p>
          </div>
        </div>
        {students.length > 0 && (
          <button onClick={exportExcel}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-colors shadow-lg shadow-green-100">
            <Download size={18} /> Export Excel
          </button>
        )}
      </div>

      {/* Subject selector */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Select Subject</label>
        <select value={selectedSubject}
          onChange={e => { setSelectedSubject(e.target.value); loadStudents(e.target.value); }}
          className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
          <option value="all">All Subjects</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name} — {s.department?.name} · Level {s.academicYear}</option>
          ))}
        </select>
      </div>

      {/* Grade type legend — editable max */}
      <div className="flex flex-wrap gap-3">
        {examTypes.map(t => (
          <div key={t.key} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2 text-sm shadow-sm">
            <span className="font-bold text-slate-700 dark:text-slate-200">{t.label}</span>
            {editingMax === t.key ? (
              <input autoFocus type="number" min={1} max={200} value={tempMax}
                onChange={e => setTempMax(e.target.value)}
                onBlur={() => { const v = Number(tempMax); if (v > 0) setExamMaxes(p => ({ ...p, [t.key]: v })); setEditingMax(null); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { const v = Number(tempMax); if (v > 0) setExamMaxes(p => ({ ...p, [t.key]: v })); setEditingMax(null); }
                  if (e.key === 'Escape') setEditingMax(null);
                }}
                className="w-14 text-center border border-indigo-300 rounded-lg px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            ) : (
              <span className="text-slate-400">/ {t.max}</span>
            )}
            <button onClick={() => { setEditingMax(t.key); setTempMax(String(t.max)); }} className="text-slate-300 hover:text-indigo-500 transition-colors">
              <Pencil size={12} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl px-4 py-2 text-sm shadow-sm">
          <span className="font-bold text-indigo-700 dark:text-indigo-300">Total</span>
          <span className="text-indigo-400">/ {maxTotal}</span>
        </div>
      </div>

      {/* Students list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={36} />
        </div>
      ) : selectedSubject === 'all' ? (
        // Separate table per subject
        <div className="space-y-6">
          {subjects.map(subj => {
            const list = students.filter(s => s.subjectId === subj.id);
            if (list.length === 0) return null;
            return (
              <div key={subj.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                  <div>
                    <span className="font-black text-indigo-700 dark:text-indigo-300">{subj.name}</span>
                    <span className="ml-2 text-xs text-indigo-400">{subj.department?.name} · Level {subj.academicYear}</span>
                  </div>
                  <span className="text-xs text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">{list.length} students</span>
                </div>
                <TableHeader />
                <StudentTable list={list} subjId={subj.id} />
              </div>
            );
          })}
          {students.length === 0 && !loading && (
            <div className="text-center py-16 text-slate-400">
              <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No students found across all subjects</p>
            </div>
          )}
        </div>
      ) : students.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
            <span className="font-black text-indigo-700 dark:text-indigo-300">{subjectInfo?.name}</span>
            <span className="text-xs text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">{students.length} students</span>
          </div>
          <TableHeader />
          <StudentTable list={students} />
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">
          <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Select a subject to view students</p>
        </div>
      )}

      {/* Grade Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{editingStudent.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{editingStudent.studentCode} · {editingStudent.subjectName || subjectInfo?.name}</p>
            </div>
            <div className="space-y-3">
              {examTypes.map(t => (
                <div key={t.key} className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t.label}</label>
                    <div className="relative">
                      <input type="number" min={0} max={t.max} value={editGrades[t.key]}
                        onChange={e => setEditGrades(p => ({ ...p, [t.key]: e.target.value }))}
                        placeholder="—"
                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">/ {t.max}</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `conic-gradient(#6366f1 ${(Number(editGrades[t.key] || 0) / t.max) * 360}deg, #e2e8f0 0deg)` }}>
                    <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-black">
                      {editGrades[t.key] || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4 flex items-center justify-between">
              <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Total</span>
              <span className="font-black text-indigo-600 dark:text-indigo-400 text-xl">
                {examTypes.reduce((s, t) => s + (Number(editGrades[t.key]) || 0), 0)} / {maxTotal}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingStudent(null)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Saving...' : 'Save Grades'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
