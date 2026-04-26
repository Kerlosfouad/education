'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, User, Hash, Building2, GraduationCap } from 'lucide-react';

interface Department { id: string; name: string; code: string; }

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableLevels, setAvailableLevels] = useState<number[]>([1, 2, 3, 4]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/student/profile').then(r => r.json()),
      fetch('/api/subjects/departments').then(r => r.json()),
    ]).then(([profileJson, deptsJson]) => {
      if (profileJson.success) {
        setName(profileJson.data.user.name || '');
        setStudentCode(profileJson.data.studentCode || '');
        setDepartmentId(profileJson.data.departmentId || '');
        setAcademicYear(String(profileJson.data.academicYear ?? ''));
      }
      if (deptsJson.success) setDepartments(deptsJson.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!departmentId) { setAvailableLevels([1, 2, 3, 4]); return; }
    const dept = departments.find(d => d.id === departmentId);
    if (dept?.code === 'PREP') {
      setAvailableLevels([0]);
      setAcademicYear('0');
    } else {
      setAvailableLevels([1, 2, 3, 4]);
      setAcademicYear(prev => prev === '0' ? '' : prev);
    }
  }, [departmentId, departments]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(false); setSaving(true);
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          studentCode: studentCode.trim(),
          departmentId: departmentId || undefined,
          academicYear: academicYear !== '' ? Number(academicYear) : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) setSuccess(true);
      else setError(json.error || 'Something went wrong');
    } catch { setError('Network error'); }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-blue-600" size={40} />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">Settings</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Update your profile information.</p>
      </div>

      <div className="bg-white dark:bg-[#0f1f38] rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm p-6">
        <form onSubmit={handleSave} className="space-y-5">
          {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl px-4 py-3 text-sm">{error}</div>}
          {success && <div className="bg-green-50 dark:bg-green-900/20 text-green-600 rounded-2xl px-4 py-3 text-sm font-medium">Saved successfully!</div>}

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your full name"
                className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-[#0a1628]/60 border border-slate-200 dark:border-[#1a2f4a] rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Student Code</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" value={studentCode} onChange={e => setStudentCode(e.target.value)} required placeholder="e.g. 24179"
                className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-[#0a1628]/60 border border-slate-200 dark:border-[#1a2f4a] rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Department</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-[#0a1628]/60 border border-slate-200 dark:border-[#1a2f4a] rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none">
                <option value="">Select department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Level</label>
            <div className="relative">
              <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-[#0a1628]/60 border border-slate-200 dark:border-[#1a2f4a] rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none">
                <option value="">Select level</option>
                {availableLevels.map(l => <option key={l} value={String(l)}>Level {l}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
