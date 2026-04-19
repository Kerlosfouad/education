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

const ALL_YEARS = [1, 2, 3, 4];
const PREP_YEARS = [0];
const SEMESTERS = [1, 2];
const YEAR_LABELS: Record<number, string> = { 0: 'Level 0', 1: 'Level 1', 2: 'Level 2', 3: 'Level 3', 4: 'Level 4' };
const SEM_LABELS: Record<number, string> = { 1: 'Semester 1', 2: 'Semester 2' };

const emptyForm = { name: '', code: '', departmentId: '', academicYear: 0, semester: 1 };

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

  const generateCode = (name: string) => {
    const ts = Date.now().toString().slice(-4);
    return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) + ts;
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (s: Subject) => {
    setEditId(s.id);
    setForm({ name: s.name, code: s.code, departmentId: s.department.id, academicYear: s.academicYear, semester: s.semester });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.departmentId) { toast.error('Please fill all required fields'); return; }
    const finalForm = { ...form, code: form.code || generateCode(form.name) };
    setSaving(true);
    try {
      const url = editId ? `/api/doctor/subjects/${editId}` : '/api/doctor/subjects';
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalForm) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(editId ? 'Subject updated' : 'Subject added');
      setShowForm(false);
      load();
    } catch (e: any) { toast.error(e.message || 'Something went wrong'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this subject?')) return;
    await fetch(`/api/doctor/subjects/${id}`, { method: 'DELETE' });
    toast.success('Subject deleted');
    load();
  };

  const filtered = subjects.filter(s =>
    (filterYear === 'all' || s.academicYear === filterYear) &&
    (filterSem === 'all' || s.semester === filterSem) &&
    (filterDept === 'all' || s.department.id === filterDept)
  );

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
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="text-indigo-600" size={28} />
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">Subjects</h2>
            <p className="text-slate-500 text-sm mt-0.5">Manage subjects by department, year and semester</p>
          </div>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">
          <Plus size={18} /> Add Subject
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
        <select value={filterYear} onChange={e => setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
          <option value="all">All Years</option>
          {ALL_YEARS.map(y => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
        </select>
        <select value={filterSem} onChange={e => setFilterSem(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
          <option value="all">All Semesters</option>
          {SEMESTERS.map(s => <option key={s} value={s}>{SEM_LABELS[s]}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="ml-auto text-sm text-slate-400 self-center">{filtered.length} subject{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Grouped subjects */}
      {Object.keys(grouped).sort().map(key => {
        const [year, sem] = key.split('-').map(Number);
        return (
          <div key={key} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center gap-3">
              <span className="font-black text-indigo-700 dark:text-indigo-300 text-base">{YEAR_LABELS[year]}</span>
              <span className="text-indigo-400">•</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{SEM_LABELS[sem]}</span>
              <span className="ml-auto text-xs text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">{grouped[key].length} subject{grouped[key].length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {grouped[key].map(s => (
                <div key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={18} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{s.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.code} • {s.department.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(s)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 hover:text-indigo-600 flex items-center justify-center transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(s.id)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors">
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
          <p className="font-medium">No subjects found</p>
          <p className="text-sm mt-1">Click "Add Subject" to get started</p>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{editId ? 'Edit Subject' : 'Add New Subject'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Subject Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Physics 1"
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Department *</label>
                <select value={form.departmentId} onChange={e => setForm(p => ({ ...p, departmentId: e.target.value, academicYear: 0 }))}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100">
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Academic Year *</label>
                  <select value={form.academicYear} onChange={e => setForm(p => ({ ...p, academicYear: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100">
                    {(departments.find(d => d.id === form.departmentId)?.code === 'PREP' ? PREP_YEARS : ALL_YEARS).map(y => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Semester *</label>
                  <select value={form.semester} onChange={e => setForm(p => ({ ...p, semester: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100">
                    {SEMESTERS.map(s => <option key={s} value={s}>{SEM_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
