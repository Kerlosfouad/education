'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Loader2, X, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Department { id: string; name: string; code: string; }
interface Subject {
  id: string; name: string; code: string;
  academicYear: number; semester: number;
  department: Department;
}

const YEARS = [1, 2, 3, 4];
const SEMESTERS = [1, 2];

const YEAR_LABELS: Record<number, string> = { 1: 'أولى', 2: 'تانية', 3: 'تالتة', 4: 'رابعة' };
const SEM_LABELS: Record<number, string> = { 1: 'الترم الأول', 2: 'الترم الثاني' };

const DEFAULT_SUBJECTS = [
  { name: 'Chemistry', code: 'CHEM101', academicYear: 1, semester: 1, deptCodes: ['COMP', 'CIVIL'] },
  { name: 'Physics 1', code: 'PHYS101', academicYear: 1, semester: 1, deptCodes: ['COMP', 'CIVIL'] },
  { name: 'Physics 2', code: 'PHYS102', academicYear: 1, semester: 2, deptCodes: ['COMP', 'CIVIL'] },
  { name: 'كتابة وتقارير فنية', code: 'TECH201', academicYear: 2, semester: 2, deptCodes: ['COMP', 'CIVIL'] },
  { name: 'مهارات العرض والاتصال', code: 'COMM301', academicYear: 2, semester: 1, deptCodes: ['CIVIL', 'ARCH', 'COMP'] },
  { name: 'القانون وحقوق الإنسان', code: 'LAW401', academicYear: 4, semester: 2, deptCodes: [] },
  { name: 'التسويق - Marketing', code: 'MKT402', academicYear: 4, semester: 2, deptCodes: [] },
];

const emptyForm = { name: '', code: '', departmentId: '', academicYear: 1, semester: 1 };

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState<number | 'all'>('all');
  const [filterSem, setFilterSem] = useState<number | 'all'>('all');
  const [filterDept, setFilterDept] = useState<string | 'all'>('all');

  const load = async () => {
    const res = await fetch('/api/doctor/subjects');
    const json = await res.json();
    if (json.success) { setSubjects(json.subjects); setDepartments(json.departments); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (s: Subject) => {
    setEditId(s.id);
    setForm({ name: s.name, code: s.code, departmentId: s.department.id, academicYear: s.academicYear, semester: s.semester });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code || !form.departmentId) { toast.error('اكمل البيانات المطلوبة'); return; }
    setSaving(true);
    try {
      const url = editId ? `/api/doctor/subjects/${editId}` : '/api/doctor/subjects';
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(editId ? 'تم التعديل' : 'تمت الإضافة');
      setShowForm(false);
      load();
    } catch (e: any) { toast.error(e.message || 'حدث خطأ'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذه المادة؟')) return;
    await fetch(`/api/doctor/subjects/${id}`, { method: 'DELETE' });
    toast.success('تم الحذف');
    load();
  };

  const filtered = subjects.filter(s =>
    (filterYear === 'all' || s.academicYear === filterYear) &&
    (filterSem === 'all' || s.semester === filterSem) &&
    (filterDept === 'all' || s.department.id === filterDept)
  );

  // Group by year then semester
  const grouped: Record<string, Subject[]> = {};
  filtered.forEach(s => {
    const key = `${s.academicYear}-${s.semester}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="text-indigo-600" size={28} />
          <div>
            <h2 className="text-3xl font-black text-slate-800">المواد الدراسية</h2>
            <p className="text-slate-500 text-sm mt-0.5">إدارة المواد حسب التخصص والسنة والترم</p>
          </div>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">
          <Plus size={18} /> إضافة مادة
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <select value={filterYear} onChange={e => setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
          <option value="all">كل السنوات</option>
          {YEARS.map(y => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
        </select>
        <select value={filterSem} onChange={e => setFilterSem(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
          <option value="all">كل الترمات</option>
          {SEMESTERS.map(s => <option key={s} value={s}>{SEM_LABELS[s]}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
          <option value="all">كل التخصصات</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="mr-auto text-sm text-slate-400 self-center">{filtered.length} مادة</span>
      </div>

      {/* Grouped subjects */}
      {Object.keys(grouped).sort().map(key => {
        const [year, sem] = key.split('-').map(Number);
        return (
          <div key={key} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3">
              <span className="font-black text-indigo-700 text-base">{YEAR_LABELS[year]}</span>
              <span className="text-indigo-400">•</span>
              <span className="font-bold text-indigo-600 text-sm">{SEM_LABELS[sem]}</span>
              <span className="mr-auto text-xs text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">{grouped[key].length} مادة</span>
            </div>
            <div className="divide-y divide-slate-50">
              {grouped[key].map(s => (
                <div key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={18} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.code} • {s.department.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(s)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 flex items-center justify-center transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(s.id)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد مواد</p>
          <p className="text-sm mt-1">اضغط "إضافة مادة" لإضافة أول مادة</p>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4" dir="rtl">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-lg">{editId ? 'تعديل المادة' : 'إضافة مادة جديدة'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">اسم المادة *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="مثال: Physics 1"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">كود المادة *</label>
                <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="مثال: PHYS101"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">التخصص *</label>
                <select value={form.departmentId} onChange={e => setForm(p => ({ ...p, departmentId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50">
                  <option value="">اختر التخصص</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">السنة الدراسية *</label>
                  <select value={form.academicYear} onChange={e => setForm(p => ({ ...p, academicYear: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50">
                    {YEARS.map(y => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">الترم *</label>
                  <select value={form.semester} onChange={e => setForm(p => ({ ...p, semester: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50">
                    {SEMESTERS.map(s => <option key={s} value={s}>{SEM_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                إلغاء
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
