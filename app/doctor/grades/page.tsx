'use client';

import { useState, useEffect } from 'react';
import { GraduationCap, Download, Loader2, Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

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
  const [search, setSearch] = useState('');
  const [examMaxes, setExamMaxes] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('grades_examMaxes');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return Object.fromEntries(DEFAULT_EXAM_TYPES.map(t => [t.key, t.max]));
  });
  const [editingMax, setEditingMax] = useState<string | null>(null);
  const [tempMax, setTempMax] = useState('');
  const [customTypes, setCustomTypes] = useState<{ key: string; label: string; max: number }[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('grades_customTypes');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('grades_hiddenDefaults');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeMax, setNewTypeMax] = useState('');

  const examTypes = [
    ...DEFAULT_EXAM_TYPES.filter(t => !hiddenDefaults.includes(t.key)).map(t => ({ ...t, max: examMaxes[t.key] })),
    ...customTypes,
  ];
  const maxTotal = examTypes.reduce((s, t) => s + t.max, 0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('grades_examMaxes', JSON.stringify(examMaxes));
    }
  }, [examMaxes]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('grades_customTypes', JSON.stringify(customTypes));
    }
  }, [customTypes]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('grades_hiddenDefaults', JSON.stringify(hiddenDefaults));
    }
  }, [hiddenDefaults]);

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

  const filterStudents = (list: StudentGrade[]) =>
    list.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.studentCode.includes(search)
    );

  const exportExcel = async () => {
    if (!students.length) return;
    const name = subjectInfo?.name || 'All Subjects';

    const border = 'border:1px solid #2E4DA0';
    const buildHtmlTable = (list: StudentGrade[], subjName: string, subj?: Subject) => {
      const headers = ['#', 'Student Name', 'Code', ...examTypes.map(t => `${t.label} (/${t.max})`), 'Total'];
      const colCount = headers.length;
      const subjectMeta = subj
        ? `${subj.department?.name ?? ''} · Level ${subj.academicYear} · Semester ${subj.semester}`
        : '';
      const rows = list.map((s, i) => {
        const total = getTotal(s.grades);
        const graded = hasGrades(s);
        const totalColor = graded ? '#00A651' : '#999999';
        const bg = i % 2 === 0 ? '#FFFFFF' : '#F8F9FF';
        return `<tr style="background:${bg}">
          <td style="text-align:center;${border};padding:5px">${i + 1}</td>
          <td style="${border};padding:5px 8px">${s.name}</td>
          <td style="text-align:center;${border};padding:5px">${s.studentCode}</td>
          ${examTypes.map(t => `<td style="text-align:center;${border};padding:5px;font-weight:bold">${s.grades[t.key] ?? 0}</td>`).join('')}
          <td style="text-align:center;${border};padding:5px;font-weight:bold;color:${totalColor}">${graded ? `${total} / ${maxTotal}` : `0 / ${maxTotal}`}</td>
        </tr>`;
      }).join('');
      return `<table style="border-collapse:collapse;width:100%">
        <tr><td colspan="${colCount}" style="background:#1F3864;color:white;font-size:14pt;font-weight:bold;text-align:center;padding:10px;${border}">${subjName}</td></tr>
        ${subjectMeta ? `<tr><td colspan="${colCount}" style="background:#2E4DA0;color:#cce0ff;font-size:10pt;text-align:center;padding:5px;${border}">${subjectMeta}</td></tr>` : ''}
        <tr><td colspan="${colCount}" style="padding:4px"></td></tr>
        <tr>${headers.map(h => `<th style="background:#2E4DA0;color:white;font-weight:bold;text-align:center;${border};padding:7px">${h}</th>`).join('')}</tr>
        ${rows}
        <tr><td colspan="${colCount}" style="padding:4px"></td></tr>
        <tr>${Array(colCount - 2).fill(`<td style="${border}"></td>`).join('')}<td colspan="2" style="background:#EEF2FF;font-weight:bold;text-align:right;padding:6px 10px;${border}">Total Students: ${list.length}</td></tr>
      </table>`;
    };

    let html = '';
    if (selectedSubject === 'all') {
      html = subjects.map(subj => {
        const list = students.filter(s => s.subjectId === subj.id);
        return list.length ? buildHtmlTable(list, subj.name, subj) : '';
      }).filter(Boolean).join('<br/><br/>');
    } else {
      html = buildHtmlTable(students, name, subjectInfo ?? undefined);
    }

    const blob = new Blob([`<html><head><meta charset="utf-8"></head><body>${html}</body></html>`], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grades-${name}-${Date.now()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reusable student table
  const StudentTable = ({ list, subjId }: { list: StudentGrade[]; subjId?: string }) => {
    const filtered = filterStudents(list);
    return (
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50 max-h-[480px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">No students match your search.</div>
        ) : filtered.map(s => {
          const graded = hasGrades(s);
          return (
            <div key={`${s.id}-${subjId}`} className={`flex items-center justify-between px-6 py-4 transition-colors ${graded ? 'bg-green-50/30 dark:bg-green-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/20'}`}>
              <div className="flex items-center gap-4 min-w-0">
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{s.name}</span>
                <span className="text-xs text-slate-400 shrink-0">{s.studentCode}</span>
              </div>
              <button onClick={() => openEdit(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${graded ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                {graded ? <><Pencil size={12} /> Edit</> : <><Check size={12} /> Set</>}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const TableHeader = () => (
    <div className="flex items-center justify-between px-6 py-3 bg-slate-50 dark:bg-slate-700/30 text-xs font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
      <span>Student</span>
      <span></span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="text-indigo-600 shrink-0" size={28} />
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100">Grades</h2>
            <p className="text-slate-500 text-sm mt-0.5">Set and manage student grades by subject</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={async () => {
            if (!confirm('Delete ALL grades for all subjects? This cannot be undone.')) return;
            if (selectedSubject === 'all') {
              // Delete grades for all subjects
              await Promise.all(subjects.map(s =>
                fetch(`/api/doctor/grades?subjectId=${s.id}`, { method: 'DELETE' })
              ));
            } else {
              await fetch(`/api/doctor/grades?subjectId=${selectedSubject}`, { method: 'DELETE' });
            }
            toast.success('All grades cleared');
            loadStudents(selectedSubject);
          }}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 transition-colors text-sm">
            <X size={16} /> Clear Grades
          </button>
          {students.length > 0 && (
            <button onClick={exportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-colors shadow-lg shadow-green-100 text-sm">
              <Download size={16} /> Export Excel
            </button>
          )}
        </div>
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

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by name or code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
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
