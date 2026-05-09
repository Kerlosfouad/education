'use client';

import { useState, useEffect } from 'react';
import { GraduationCap, Download, Loader2, Check, Pencil, Plus, X, ChevronRight, BookOpen, CalendarCheck2, Trophy } from 'lucide-react';
import { toast } from 'sonner';

interface Subject { id: string; name: string; code: string; department: { name: string }; academicYear: number; semester: number; }
interface StudentGrade { id: string; name: string; studentCode: string; grades: Record<string, number>; subjectId?: string; subjectName?: string; }

interface StudentDetail {
  id: string;
  studentCode: string;
  academicYear: number;
  user: { name: string; email: string };
  department: { name: string };
  assignmentSubmissions: {
    id: string;
    submittedAt: string;
    score: number | null;
    assignment: { title: string; maxScore: number | null; subject: { name: string } | null };
  }[];
  quizAttempts: {
    id: string;
    score: number | null;
    percentage: number | null;
    completedAt: string | null;
    quiz: { title: string; subject: { name: string } | null };
  }[];
  attendances: {
    id: string;
    verificationMethod: string;
    timestamp: string;
    session: { title: string | null; openTime: string; closeTime: string };
  }[];
}

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
  const [search, setSearch] = useState('');
  const [detailStudent, setDetailStudent] = useState<StudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'attendance' | 'assignments' | 'quizzes'>('attendance');

  const openStudentDetail = async (studentId: string) => {
    setDetailLoading(true);
    setDetailStudent(null);
    setDetailTab('attendance');
    const res = await fetch(`/api/doctor/student-detail?studentId=${studentId}`);
    const json = await res.json();
    if (json.success) setDetailStudent(json.data);
    setDetailLoading(false);
  };

  // Lock body scroll when detail modal is open
  useEffect(() => {
    if (detailLoading || detailStudent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [detailLoading, detailStudent]);

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
      // Check if all fields are empty → delete all grades (reset to Set state)
      const allEmpty = examTypes.every(t => editGrades[t.key] === '' || editGrades[t.key] === undefined);
      if (allEmpty) {
        await fetch('/api/doctor/grades', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId, studentId: editingStudent.id }),
        });
        toast.success('Grades cleared');
        setEditingStudent(null);
        loadStudents(selectedSubject);
        setSaving(false);
        return;
      }
      // Save each exam type — empty fields save as 0
      for (const t of examTypes) {
        const val = editGrades[t.key];
        const score = val === '' || val === undefined ? 0 : Number(val);
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
    const buildHtmlTable = (list: StudentGrade[], subjName: string, deptName?: string, level?: number) => {
      const headers = ['#', 'Student Name', 'Code', ...examTypes.map(t => `${t.label} (/${t.max})`), 'Total'];
      const colCount = headers.length;
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
      const titleParts = [deptName, level !== undefined ? `Level ${level}` : undefined, subjName].filter(Boolean).join(' - ');
      return `<table style="border-collapse:collapse;width:100%">
        <tr><td colspan="${colCount}" style="background:#1F3864;color:white;font-size:14pt;font-weight:bold;text-align:center;padding:10px;${border}">${titleParts}</td></tr>
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
        return list.length ? buildHtmlTable(list, subj.name, subj.department?.name, subj.academicYear) : '';
      }).filter(Boolean).join('<br/><br/>');
    } else {
      html = buildHtmlTable(students, name, subjectInfo?.department?.name, subjectInfo?.academicYear);
    }

    const blob = new Blob([`<html><head><meta charset="utf-8"></head><body>${html}</body></html>`], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grades-${name}-${Date.now()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAllGrades = async () => {
    const subjectId = selectedSubject;
    if (!subjectId || subjectId === 'all') { toast.error('Please select a specific subject to clear grades'); return; }
    if (!confirm('Are you sure you want to clear all grades for this subject? This cannot be undone.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/doctor/grades', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('All grades cleared');
        loadStudents(selectedSubject);
      } else {
        toast.error('Failed to clear grades');
      }
    } catch {
      toast.error('Failed to clear grades');
    }
    setLoading(false);
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
              <button
                onClick={() => openStudentDetail(s.id)}
                className="flex items-center gap-4 min-w-0 flex-1 text-left hover:opacity-70 transition-opacity"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{s.name}</span>
                <span className="text-xs text-slate-400 shrink-0">{s.studentCode}</span>
                <ChevronRight size={14} className="text-slate-300 shrink-0" />
              </button>
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <GraduationCap className="text-indigo-600" size={28} />
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">Grades</h2>
            <p className="text-slate-500 text-sm mt-0.5">Set and manage student grades by subject</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {students.length > 0 && (
            <button onClick={clearAllGrades}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-red-600 text-white font-bold rounded-xl sm:rounded-2xl hover:bg-red-700 transition-colors shadow-lg shadow-red-100 text-xs sm:text-sm flex-1 sm:flex-initial">
              <X size={16} className="sm:w-[18px] sm:h-[18px]" /> 
              <span className="hidden sm:inline">Clear All</span>
              <span className="sm:hidden">Clear</span>
            </button>
          )}
          {students.length > 0 && (
            <button onClick={exportExcel}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-green-600 text-white font-bold rounded-xl sm:rounded-2xl hover:bg-green-700 transition-colors shadow-lg shadow-green-100 text-xs sm:text-sm flex-1 sm:flex-initial">
              <Download size={16} className="sm:w-[18px] sm:h-[18px]" /> 
              <span className="hidden sm:inline">Export Excel</span>
              <span className="sm:hidden">Export</span>
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

      {/* Grade type legend — editable max */}
      <div className="flex flex-wrap gap-3 items-center">
        {examTypes.map(t => {
          const isDefault = DEFAULT_EXAM_TYPES.some(d => d.key === t.key);
          return (
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
              <button onClick={() => {
                  if (isDefault) {
                    setHiddenDefaults(p => [...p, t.key]);
                  } else {
                    setCustomTypes(p => p.filter(c => c.key !== t.key));
                  }
                }}
                className="text-slate-300 hover:text-red-500 transition-colors ml-1">
                <X size={12} />
              </button>            </div>
          );
        })}
        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl px-4 py-2 text-sm shadow-sm">
          <span className="font-bold text-indigo-700 dark:text-indigo-300">Total</span>
          <span className="text-indigo-400">/ {maxTotal}</span>
        </div>

        {/* Add new type */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 shadow-sm">
          <input value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
            placeholder="Name"
            className="w-20 text-xs border-none outline-none bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-400"
          />
          <span className="text-slate-300">/</span>
          <input value={newTypeMax} onChange={e => setNewTypeMax(e.target.value)}
            placeholder="Max" type="number" min={1}
            className="w-12 text-xs border-none outline-none bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-400"
          />
          <button
            onClick={() => {
              const label = newTypeName.trim();
              const max = Number(newTypeMax);
              if (!label || !max) return;
              const key = `CUSTOM_${label.toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`;
              setCustomTypes(p => [...p, { key, label, max }]);
              setExamMaxes(p => ({ ...p, [key]: max }));
              setNewTypeName('');
              setNewTypeMax('');
            }}
            className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors flex-shrink-0">
            <Plus size={12} />
          </button>
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

      {/* Student Detail Modal */}
      {(detailLoading || detailStudent) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setDetailStudent(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
              </div>
            ) : detailStudent && (
              <>
                {/* drag handle on mobile */}
                <div className="sm:hidden w-10 h-1 bg-slate-200 dark:bg-slate-600 rounded-full mx-auto mt-3 shrink-0" />

                {/* Header */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base sm:text-lg truncate">{detailStudent.user.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">#{detailStudent.studentCode} · {detailStudent.department.name} · Level {detailStudent.academicYear}</p>
                  </div>
                  <button onClick={() => setDetailStudent(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors shrink-0">
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-4 sm:px-6 pt-3 sm:pt-4 shrink-0">
                  {([
                    { key: 'attendance', label: 'Attendance', icon: CalendarCheck2, count: detailStudent.attendances.filter(a => a.verificationMethod !== 'ABSENT').length },
                    { key: 'assignments', label: 'Assignments', icon: BookOpen, count: detailStudent.assignmentSubmissions.length },
                    { key: 'quizzes', label: 'Quizzes', icon: Trophy, count: detailStudent.quizAttempts.length },
                  ] as const).map(tab => (
                    <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-colors flex-1 justify-center sm:flex-none ${detailTab === tab.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200'}`}>
                      <tab.icon size={12} />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.slice(0, 6)}</span>
                      <span className={`text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full font-black ${detailTab === tab.key ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-600'}`}>{tab.count}</span>
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-2">

                  {/* Attendance Tab */}
                  {detailTab === 'attendance' && (
                    detailStudent.attendances.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm">No attendance records.</div>
                    ) : (
                      detailStudent.attendances.map(a => {
                        const present = a.verificationMethod !== 'ABSENT';
                        return (
                          <div key={a.id} className={`flex items-center justify-between px-4 py-3 rounded-xl ${present ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                            <div>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{a.session.title || 'Session'}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{new Date(a.session.openTime).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {present ? '✓ Present' : '✗ Absent'}
                            </span>
                          </div>
                        );
                      })
                    )
                  )}

                  {/* Assignments Tab */}
                  {detailTab === 'assignments' && (
                    detailStudent.assignmentSubmissions.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm">No assignment submissions.</div>
                    ) : (
                      detailStudent.assignmentSubmissions.map(sub => {
                        const isGraded = sub.score !== null;
                        return (
                          <div key={sub.id} className={`flex items-center justify-between px-4 py-3 rounded-xl ${isGraded ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                            <div>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{sub.assignment.title}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {sub.assignment.subject?.name} · {new Date(sub.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isGraded ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'}`}>
                              {isGraded ? `${sub.score} / ${sub.assignment.maxScore ?? '?'}` : 'Submitted'}
                            </span>
                          </div>
                        );
                      })
                    )
                  )}

                  {/* Quizzes Tab */}
                  {detailTab === 'quizzes' && (
                    detailStudent.quizAttempts.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm">No quiz attempts.</div>
                    ) : (
                      detailStudent.quizAttempts.map(attempt => (
                        <div key={attempt.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                          <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{attempt.quiz.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {attempt.quiz.subject?.name}
                              {attempt.completedAt && ` · ${new Date(attempt.completedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${(attempt.percentage ?? 0) >= 60 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {attempt.score ?? 0} pts
                            </span>
                            {attempt.percentage !== null && (
                              <p className="text-[10px] text-slate-400 mt-1">{attempt.percentage}%</p>
                            )}
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
