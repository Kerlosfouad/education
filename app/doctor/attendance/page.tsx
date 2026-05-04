'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarCheck2, Plus, Users, Clock, CheckCircle2, XCircle, Loader2, X, Check, MoreVertical, Trash2, Search } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface AttendanceRecord { studentId: string; verificationMethod: string; }
interface AttendanceSession {
  id: string; title: string | null; openTime: string; closeTime: string;
  isOpen: boolean; createdAt: string; subject: { name: string };
  _count: { attendances: number }; attendances?: AttendanceRecord[];
  department?: { name: string } | null;
  academicYear?: number | null;
  semester?: number | null;
}
interface Student { 
  id: string; 
  studentCode: string; 
  academicYear: number;
  user: { name: string; email: string }; 
  department: { name: string };
}
interface Subject { id: string; name: string; }
interface Department { id: string; name: string; nameAr?: string; code?: string; }
export default function AttendancePage() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableLevels, setAvailableLevels] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'sessions' | 'table'>('sessions');
  const [form, setForm] = useState({ subjectId: '', departmentId: '', academicYear: '', semester: '1', title: '', durationHours: '1', durationMinutes: '0' });
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [tableAvailableLevels, setTableAvailableLevels] = useState<number[]>([]);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, subRes, stuRes] = await Promise.all([
        fetch('/api/attendance'), fetch('/api/subjects'), fetch('/api/students'),
      ]);
      const [sessJson, subJson, stuJson] = await Promise.all([sessRes.json(), subRes.json(), stuRes.json()]);
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
      const deptRes = await fetch('/api/subjects/departments');
      const deptJson = await deptRes.json();
      if (deptJson.success) setDepartments(deptJson.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!form.departmentId) {
      setAvailableLevels([1, 2, 3, 4]);
      return;
    }
    const dept = departments.find(d => d.id === form.departmentId);
    if (dept?.code === 'PREP') {
      setAvailableLevels([0]);
      setForm(f => ({ ...f, academicYear: '0' }));
    } else {
      setAvailableLevels([1, 2, 3, 4]);
      setForm(f => ({ ...f, academicYear: '' }));
    }
  }, [form.departmentId, departments]);

  useEffect(() => {
    if (!filterDept) {
      setTableAvailableLevels([]);
      setFilterLevel('');
      return;
    }
    const dept = departments.find(d => d.name === filterDept);
    if (dept?.code === 'PREP') {
      setTableAvailableLevels([0]);
      setFilterLevel('0');
    } else {
      setTableAvailableLevels([1, 2, 3, 4]);
      setFilterLevel('');
    }
  }, [filterDept, departments]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const now = new Date();
      const durationMs = (parseInt(form.durationHours) * 60 + parseInt(form.durationMinutes)) * 60 * 1000;
      const closeTime = new Date(now.getTime() + durationMs);
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || undefined,
          departmentId: form.departmentId || undefined,
          academicYear: form.academicYear !== '' ? Number(form.academicYear) : undefined,
          semester: Number(form.semester),
          openTime: now.toISOString(),
          closeTime: closeTime.toISOString(),
        }),
      });
      const json = await res.json();
      if (json.success) { setShowModal(false); setForm({ subjectId: '', departmentId: '', academicYear: '', semester: '1', title: '', durationHours: '1', durationMinutes: '0' }); fetchData(); }
      else setError(json.error || t('errorOccurred'));
    } catch { setError('Network error'); }
    setSaving(false);
  };

  const toggleSession = async (id: string, isOpen: boolean) => {
    await fetch('/api/attendance', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, isOpen: !isOpen }),
    });
    setSessions(prev => prev.map(s => s.id === id ? { ...s, isOpen: !isOpen } : s));
    setMenuSessionId(null);
  };

  const deleteSession = async (id: string) => {
    if (!confirm('Delete this attendance session permanently?')) return;
    await fetch('/api/attendance', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id }),
    });
    setMenuSessionId(null);
    fetchData();
  };

  const openModal = () => {
    setForm({ subjectId: '', departmentId: '', academicYear: '', semester: '1', title: '', durationHours: '1', durationMinutes: '0' });
    setError(''); setShowModal(true);
  };

  const filteredStudents = students.filter(student => {
    const matchDept = !filterDept || student.department.name === filterDept;
    const matchLevel = !filterLevel || String(student.academicYear) === filterLevel;
    const matchSearch = !search || student.user.name.toLowerCase().includes(search.toLowerCase()) || student.studentCode.includes(search);
    return matchDept && matchLevel && matchSearch;
  });  const getStatus = (session: AttendanceSession, studentId: string) => {
    const record = session.attendances?.find(a => a.studentId === studentId);
    if (!record) return 'unknown';
    if (record.verificationMethod === 'ABSENT') return 'absent';
    return 'present';
  };

  // Check if a session applies to a student (by dept/level)
  const sessionAppliesToStudent = (session: AttendanceSession, student: Student) => {
    const deptMatch = !session.department || session.department.name === student.department.name;
    const levelMatch = session.academicYear === null || session.academicYear === undefined || session.academicYear === student.academicYear;
    return deptMatch && levelMatch;
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Attendance Tracking</h2>
          <p className="text-slate-500 mt-1 font-medium">Create sessions and track student attendance.</p>
        </div>
        <button onClick={openModal} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all w-fit">
          <Plus size={20} /> New Session
        </button>
      </div>

      <div className="flex gap-2">
        {(['sessions', 'table'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
            {tab === 'sessions'
              ? `${t('sessionsTab')} (${sessions.length})`
              : t('attendanceTable')}
          </button>
        ))}
      </div>

      {activeTab === 'sessions' && (
        sessions.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm text-center py-20">
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
                  <div key={s.id} className="relative bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-2xl flex items-center justify-center ${isActive ? 'bg-green-100' : 'bg-slate-100'}`}>
                        <CalendarCheck2 className={isActive ? 'text-green-600' : 'text-slate-400'} size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 text-sm md:text-base truncate">{s.title || 'Session'}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {s.department
                            ? <span className="font-medium text-slate-500">{s.department.name}{s.academicYear !== null && s.academicYear !== undefined ? ` • Level ${s.academicYear}` : ''}</span>
                            : <span>All Students</span>
                          }
                          <span> • {new Date(s.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </p>
                      </div>
                    </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${isActive ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                          {isActive ? `🟢 ${t('open')}` : `⚫ ${t('closed')}`}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuSessionId(prev => (prev === s.id ? null : s.id));
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                          aria-label="Session actions"
                        >
                          <MoreVertical size={18} />
                        </button>
                      </div>
                  </div>

                    {menuSessionId === s.id && (
                      <div className="absolute top-14 right-4 z-50 w-48 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => deleteSession(s.id)}
                          className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          {t('deleteSession')}
                        </button>
                      </div>
                    )}

                  <div className="flex flex-wrap items-center gap-3 text-xs mb-4">
                    <span className="flex items-center gap-1 text-slate-400"><Clock size={12} />{new Date(s.openTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} → {new Date(s.closeTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="flex items-center gap-1 text-green-600 font-bold"><Check size={12} /> {presentCount} {t('present')}</span>
                    <span className="flex items-center gap-1 text-red-500 font-bold"><X size={12} /> {absentCount} {t('absent')}</span>
                  </div>
                  <button onClick={() => toggleSession(s.id, s.isOpen)}
                    className={`w-full py-2.5 rounded-2xl text-sm font-bold transition-colors ${s.isOpen ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                    {s.isOpen ? t('closeSession') : t('openSession')}
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'table' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-52"
                />
              </div>
              <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setFilterLevel(''); }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">All Levels</option>
                {tableAvailableLevels.map(l => <option key={l} value={String(l)}>Level {l}</option>)}
              </select>
              <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">All Semesters</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
              {(filterDept || filterLevel || filterSemester || search) && (
                <button onClick={() => { setFilterDept(''); setFilterLevel(''); setFilterSemester(''); setSearch(''); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                  <X size={14} /> Clear
                </button>
              )}
            </div>
          </div>

          {sessions.length === 0 || students.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm text-center py-20 text-slate-400">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p>{t('notEnoughData')}</p>
            </div>
          ) : (
            departments
              .filter(dept => !filterDept || dept.name === filterDept)
              .map(dept => {
              const deptStudents = students.filter(s => s.department.name === dept.name);
              if (deptStudents.length === 0) return null;

              const levelSet = new Set(deptStudents.map(s => s.academicYear));
              const levels = Array.from(levelSet).sort((a, b) => a - b)
                .filter(l => !filterLevel || String(l) === filterLevel);

              return (
                <div key={dept.id}>
                  {levels.map(level => {
                    const levelStudents = deptStudents.filter(s => s.academicYear === level);

                    // Filter sessions by semester if selected
                    const visibleSessions = sessions.filter(s => {
                      const deptMatch = !s.department || s.department.name === dept.name;
                      const levelMatch = s.academicYear === null || s.academicYear === undefined || s.academicYear === level;
                      const sem = (s as any).semester;
                      // If session has no semester set (null/undefined), show in all semesters
                      const semesterMatch = !filterSemester || sem === null || sem === undefined || String(sem) === filterSemester;
                      return deptMatch && levelMatch && semesterMatch;
                    });

                    const filteredLevelStudents = levelStudents.filter(student => {
                      const matchSearch = !search || student.user.name.toLowerCase().includes(search.toLowerCase()) || student.studentCode.includes(search);
                      return matchSearch;
                    });

                    if (filteredLevelStudents.length === 0) return null;

                    return (
                      <div key={`${dept.id}-${level}`} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                          <div>
                            <span className="font-black text-indigo-700 dark:text-indigo-300">{dept.name}</span>
                            <span className="ml-2 text-xs text-indigo-400">Level {level}</span>
                          </div>
                          <span className="text-xs text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">{filteredLevelStudents.length} students</span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="p-4 text-xs font-bold text-slate-500 text-left sticky left-0 bg-slate-50 z-10 border-b border-slate-100 min-w-[200px]">Student</th>
                                <th className="p-4 text-xs font-bold text-slate-500 text-left border-b border-slate-100 min-w-[100px]">Code</th>
                                {visibleSessions.map(s => (
                                  <th key={s.id} className="p-3 text-[10px] font-bold text-slate-400 text-center border-b border-slate-100 min-w-[100px]">
                                    <div>{s.title || s.subject?.name || 'Session'}</div>
                                    <div className="text-slate-300 font-normal">{new Date(s.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                  </th>
                                ))}
                                <th className="p-3 text-[10px] font-bold text-slate-400 text-center border-b border-slate-100 min-w-[70px]">{t('percentage')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {filteredLevelStudents.map(student => {
                                const studentSessions = visibleSessions.filter(s => sessionAppliesToStudent(s, student));
                                const presentCount = studentSessions.filter(s => getStatus(s, student.id) === 'present').length;
                                const rate = studentSessions.length > 0 ? Math.round((presentCount / studentSessions.length) * 100) : 0;                                return (
                                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 sticky left-0 bg-white z-10 border-r border-slate-100">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                                          {student.user.name?.charAt(0) ?? '?'}
                                        </div>
                                        <p className="font-bold text-slate-700 text-sm">{student.user.name}</p>
                                      </div>
                                    </td>
                                    <td className="p-4 text-sm font-mono text-slate-500 border-r border-slate-100">{student.studentCode}</td>
                                    {visibleSessions.map(s => {
                                      if (!sessionAppliesToStudent(s, student)) {
                                        return (
                                          <td key={s.id} className="p-2 text-center border-r border-slate-50">
                                            <div className="w-7 h-7 mx-auto rounded-lg bg-red-50 flex items-center justify-center">
                                              <XCircle size={14} className="text-red-500" />
                                            </div>
                                          </td>
                                        );
                                      }
                                      const status = getStatus(s, student.id);
                                      return (
                                        <td key={s.id} className="p-2 text-center border-r border-slate-50">
                                          {status === 'present' && (
                                            <div className="w-7 h-7 mx-auto rounded-lg bg-green-50 flex items-center justify-center">
                                              <CheckCircle2 size={14} className="text-green-600" />
                                            </div>
                                          )}
                                          {(status === 'absent' || status === 'unknown') && (
                                            <div className="w-7 h-7 mx-auto rounded-lg bg-red-50 flex items-center justify-center">
                                              <XCircle size={14} className="text-red-500" />
                                            </div>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="p-3 text-center">
                                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${rate >= 75 ? 'bg-green-100 text-green-700' : rate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                        {rate}%
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">{t('newAttendanceSession')}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} className="text-slate-400" /></button>
            </div>
            {error && <div className="bg-red-50 text-red-600 rounded-2xl px-4 py-3 text-sm mb-4">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">{t('sessionTitleOptional')}</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Week 3 lecture"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Department</label>
                <select value={form.departmentId} onChange={e => {
                    const newDeptId = e.target.value;
                    setForm(f => ({ ...f, departmentId: newDeptId, academicYear: '' }));
                  }}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.nameAr || d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Level</label>
                <select value={(form as any).academicYear || ''} onChange={e => setForm(f => ({ ...f, academicYear: e.target.value } as any))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">All Levels</option>
                  {availableLevels.map(l => <option key={l} value={l}>Level {l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Semester</label>
                <select value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Session Duration *</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Hours</label>
                    <select value={form.durationHours} onChange={e => setForm(f => ({ ...f, durationHours: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      {[0,1,2,3,4,5,6].map(h => <option key={h} value={h}>{h}h</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Minutes</label>
                    <select value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      {[0,15,30,45].map(m => <option key={m} value={m}>{m}m</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                {saving ? t('saving') : t('createSession')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
