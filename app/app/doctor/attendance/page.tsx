'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarCheck2, Plus, Users, Clock, CheckCircle2, XCircle, Loader2, X, Check } from 'lucide-react';

interface AttendanceRecord { studentId: string; verificationMethod: string; }
interface AttendanceSession {
  id: string; title: string | null; openTime: string; closeTime: string;
  isOpen: boolean; createdAt: string; subject: { name: string };
  _count: { attendances: number }; attendances?: AttendanceRecord[];
}
interface Student { id: string; studentCode: string; user: { name: string; email: string }; }
interface Subject { id: string; name: string; }

export default function AttendancePage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const LEVELS = [1, 2, 3, 4];
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'sessions' | 'table'>('sessions');
  const [form, setForm] = useState({ subjectId: '', title: '', openTime: '', closeTime: '', departmentId: '', academicYear: '' });

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, subRes, stuRes, deptRes] = await Promise.all([
        fetch('/api/attendance'), fetch('/api/subjects'), fetch('/api/students'), fetch('/api/subjects/departments'),
      ]);
      const [sessJson, subJson, stuJson, deptJson] = await Promise.all([sessRes.json(), subRes.json(), stuRes.json(), deptRes.json()]);
      if (sessJson.success) {
        const sessionsWithRecords = await Promise.all(
          sessJson.data.map(async (s: AttendanceSession) => {
            const r = await fetch('/api/attendance?sessionId=' + s.id);
            const rj = await r.json();
            return { ...s, attendances: rj.success ? rj.data : [] };
          })
        );
        setSessions(sessionsWithRecords);
      }
      if (subJson.success) setSubjects(subJson.data);
      if (stuJson.success) setStudents(stuJson.data);
      if (deptJson.success) setDepartments(deptJson.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: form.subjectId || undefined,
          title: form.title || undefined,
          openTime: new Date(form.openTime).toISOString(),
          closeTime: new Date(form.closeTime).toISOString(),
          departmentId: form.departmentId || undefined,
          academicYear: form.academicYear ? Number(form.academicYear) : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowModal(false);
        setForm({ subjectId: '', title: '', openTime: '', closeTime: '', departmentId: '', academicYear: '' });
        fetchData();
      } else {
        setError(json.error || 'An error occurred');
      }
    } catch { setError('Network error'); }
    setSaving(false);
  };

  const toggleSession = async (id: string, isOpen: boolean) => {
    await fetch('/api/attendance', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, isOpen: !isOpen }),
    });
    setSessions(prev => prev.map(s => s.id === id ? { ...s, isOpen: !isOpen } : s));
  };

  const openModal = () => {
    const now = new Date();
    const close = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 16);
    setForm(f => ({ ...f, openTime: fmt(now), closeTime: fmt(close) }));
    setError(''); setShowModal(true);
  };

  const getStatus = (session: AttendanceSession, studentId: string) => {
    const record = session.attendances?.find(a => a.studentId === studentId);
    if (!record) return 'unknown';
    if (record.verificationMethod === 'ABSENT') return 'absent';
    return 'present';
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Attendance Tracking</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Create sessions and track student attendance.</p>
        </div>
        <button onClick={openModal}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none transition-all w-fit">
          <Plus size={20} /> New Session
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveTab('sessions')}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'sessions' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-[#0d1e35] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#1a2f4a] hover:bg-slate-50 dark:hover:bg-[#132540]'}`}>
          Sessions ({sessions.length})
        </button>
        <button onClick={() => setActiveTab('table')}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'table' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-[#0d1e35] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#1a2f4a] hover:bg-slate-50 dark:hover:bg-[#132540]'}`}>
          Attendance Table
        </button>
      </div>

      {activeTab === 'sessions' && (
        sessions.length === 0 ? (
          <div className="bg-white dark:bg-[#0f1f38] rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm text-center py-20">
            <CalendarCheck2 size={48} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400 font-medium">No attendance sessions yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {sessions.map(s => {
              const now = new Date();
              const isActive = s.isOpen && new Date(s.openTime) <= now && new Date(s.closeTime) >= now;
              const presentCount = s.attendances?.filter(a => a.verificationMethod !== 'ABSENT').length ?? 0;
              const absentCount = s.attendances?.filter(a => a.verificationMethod === 'ABSENT').length ?? 0;
              return (
                <div key={s.id} className="bg-white dark:bg-[#0f1f38] p-6 rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isActive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-[#0a1628]/60'}`}>
                        <CalendarCheck2 className={isActive ? 'text-green-600' : 'text-slate-400'} size={22} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">{s.title || s.subject.name}</h3>
                        <p className="text-xs text-slate-400">{s.subject.name} &bull; {new Date(s.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 animate-pulse' : 'bg-slate-100 dark:bg-[#0a1628]/60 text-slate-500 dark:text-slate-400'}`}>
                      {isActive ? '🟢 Open' : '⚫ Closed'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs mb-4">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock size={12} />
                      {new Date(s.openTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} &rarr; {new Date(s.closeTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex items-center gap-1 text-green-600 font-bold"><Check size={12} /> {presentCount} present</span>
                    <span className="flex items-center gap-1 text-red-500 font-bold"><X size={12} /> {absentCount} absent</span>
                  </div>
                  <button onClick={() => toggleSession(s.id, s.isOpen)}
                    className={`w-full py-2.5 rounded-2xl text-sm font-bold transition-colors ${s.isOpen ? 'bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'}`}>
                    {s.isOpen ? 'Close Session' : 'Open Session'}
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'table' && (
        <div className="bg-white dark:bg-[#0f1f38] rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm overflow-hidden">
          {sessions.length === 0 || students.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p>No data available to display the table.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#0a1628]/60">
                    <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 text-left sticky left-0 bg-slate-50 dark:bg-[#0a1628] z-10 border-b border-slate-100 dark:border-[#1a2f4a] min-w-[160px]">Student</th>
                    {sessions.map(s => (
                      <th key={s.id} className="p-3 text-[10px] font-bold text-slate-400 text-center border-b border-slate-100 dark:border-[#1a2f4a] min-w-[80px]">
                        <div>{s.title || s.subject.name}</div>
                        <div className="text-slate-300 font-normal">{new Date(s.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </th>
                    ))}
                    <th className="p-3 text-[10px] font-bold text-slate-400 text-center border-b border-slate-100 dark:border-[#1a2f4a] min-w-[70px]">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-[#1a2f4a]">
                  {students.map(student => {
                    const presentCount = sessions.filter(s => getStatus(s, student.id) === 'present').length;
                    const rate = sessions.length > 0 ? Math.round((presentCount / sessions.length) * 100) : 0;
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-[#0a1628]/30 transition-colors">
                        <td className="p-4 sticky left-0 bg-white dark:bg-[#0f1f38] z-10 border-r border-slate-100 dark:border-[#1a2f4a]">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                              {student.user.name?.charAt(0) ?? '?'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-700 dark:text-white text-sm">{student.user.name}</p>
                              <p className="text-[10px] text-slate-400">{student.studentCode}</p>
                            </div>
                          </div>
                        </td>
                        {sessions.map(s => {
                          const status = getStatus(s, student.id);
                          return (
                            <td key={s.id} className="p-2 text-center border-r border-slate-50 dark:border-[#1a2f4a]">
                              {status === 'present' && <div className="w-7 h-7 mx-auto rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center"><CheckCircle2 size={14} className="text-green-600" /></div>}
                              {status === 'absent' && <div className="w-7 h-7 mx-auto rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center"><XCircle size={14} className="text-red-500" /></div>}
                              {status === 'unknown' && <div className="w-7 h-7 mx-auto rounded-lg bg-slate-50 dark:bg-[#0a1628]/60 flex items-center justify-center"><span className="text-slate-300 text-xs">—</span></div>}
                            </td>
                          );
                        })}
                        <td className="p-3 text-center">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${rate >= 75 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : rate >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f1f38] w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">New Attendance Session</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-[#0a1628]/60 rounded-xl">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl px-4 py-3 text-sm mb-4">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Subject *</label>
                <select required value={form.subjectId} onChange={e => {
                  const subj = subjects.find(s => s.id === e.target.value);
                  setForm(f => ({
                    ...f,
                    subjectId: e.target.value,
                    departmentId: (subj as any)?.departmentId || f.departmentId,
                    academicYear: (subj as any)?.academicYear ? String((subj as any).academicYear) : f.academicYear,
                  }));
                }}
                  className="w-full border border-slate-200 dark:border-[#1a2f4a] dark:bg-[#132540] dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">Select subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Department</label>
                  <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-[#1a2f4a] dark:bg-[#132540] dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Level</label>
                  <select value={form.academicYear} onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-[#1a2f4a] dark:bg-[#132540] dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">All Levels</option>
                    {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Session Title (optional)</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Lecture 3"
                  className="w-full border border-slate-200 dark:border-[#1a2f4a] dark:bg-[#132540] dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Open Time *</label>
                  <input type="datetime-local" required value={form.openTime} onChange={e => setForm(f => ({ ...f, openTime: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-[#1a2f4a] dark:bg-[#132540] dark:text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Close Time *</label>
                  <input type="datetime-local" required value={form.closeTime} onChange={e => setForm(f => ({ ...f, closeTime: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-[#1a2f4a] dark:bg-[#132540] dark:text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                {saving ? 'Saving...' : 'Create Session'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
