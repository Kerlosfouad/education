'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Filter, Clock, MoreVertical,
  Calendar, CheckCircle2, XCircle, Loader2,
  X, Hash, Building2, GraduationCap, QrCode, Mail,
} from 'lucide-react';
import Image from 'next/image';

interface StudentRow {
  id: string;
  name: string;
  studentCode: string;
  attendanceRate: number;
  quizRate: number;
  avgQuizScore: number;
}

interface StudentRecord {
  id: string;
  userId: string;
  studentCode: string;
  academicYear: number;
  department: { name: string };
  user: { name: string; email: string; image: string | null; createdAt: string; status: string };
}

interface StudentDetail {
  id: string;
  studentCode: string;
  academicYear: number;
  qrCode: string | null;
  user: { name: string; email: string; image: string | null };
  department: { name: string };
}

export default function StudentsPage() {
  const [analytics, setAnalytics] = useState<StudentRow[]>([]);
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
  const [activeStudents, setActiveStudents] = useState<StudentDetail[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'pending' | 'active'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, pendingRes, studentsRes] = await Promise.all([
        fetch('/api/doctor/analytics'),
        fetch('/api/students/pending'),
        fetch('/api/students'),
      ]);
      const [analyticsJson, pendingJson, studentsJson] = await Promise.all([
        analyticsRes.json(), pendingRes.json(), studentsRes.json(),
      ]);
      if (Array.isArray(analyticsJson)) setAnalytics(analyticsJson);
      if (pendingJson.success) setAllStudents(pendingJson.data);
      if (studentsJson.success) setActiveStudents(studentsJson.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (studentId: string, userId: string, action: 'approve' | 'reject') => {
    setActionLoading(studentId + action);
    try {
      const res = await fetch('/api/students/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, userId, action }),
      });
      const json = await res.json();
      if (json.success) {
        setAllStudents(prev => prev.filter(s => s.id !== studentId));
      }
    } catch {}
    setActionLoading(null);
  };

  const handleDelete = async (studentId: string) => {
    if (!confirm('Delete this student permanently?')) return;
    setDeleteLoading(studentId);
    setMenuOpen(null);
    try {
      const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setActiveStudents(prev => prev.filter(s => s.id !== studentId));
        setAnalytics(prev => prev.filter(s => s.id !== studentId));
        if (selectedStudent?.id === studentId) setSelectedStudent(null);
      }
    } catch {}
    setDeleteLoading(null);
  };

  const pending = allStudents;

  const filteredAnalytics = activeStudents
    .filter(s =>
      s.user.name.toLowerCase().includes(search.toLowerCase()) ||
      s.studentCode.includes(search)
    )
    .map(s => {
      const analyticsData = analytics.find(a => a.studentCode === s.studentCode);
      return {
        id: s.id,
        name: s.user.name,
        studentCode: s.studentCode,
        image: s.user.image,
        attendanceRate: analyticsData?.attendanceRate ?? 0,
        avgQuizScore: analyticsData?.avgQuizScore ?? 0,
        quizRate: analyticsData?.quizRate ?? 0,
      };
    });

  const getStatus = (rate: number) => {
    if (rate >= 75) return { label: 'Active', cls: 'bg-emerald-50 text-emerald-600' };
    if (rate >= 50) return { label: 'Warning', cls: 'bg-yellow-50 text-yellow-600' };
    return { label: 'At Risk', cls: 'bg-orange-50 text-orange-600' };
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-blue-600" size={40} />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">Student Management</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">Monitor attendance, quizzes, and registration requests.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search students..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-[#0d1e35] dark:text-white border border-slate-200 dark:border-[#1a2f4a] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-full md:w-64" />
          </div>
          <button className="p-2 bg-white dark:bg-[#0d1e35] border border-slate-200 dark:border-[#1a2f4a] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#132540]">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('pending')}
          className={`flex-1 md:flex-none px-3 md:px-5 py-2 rounded-xl text-xs md:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${tab === 'pending' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#0d1e35] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#1a2f4a] hover:bg-slate-50 dark:hover:bg-[#132540]'}`}>
          <Clock size={13} />
          <span className="whitespace-nowrap">Pending</span>
          {pending.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${tab === 'pending' ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-600'}`}>
              {pending.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('active')}
          className={`flex-1 md:flex-none px-3 md:px-5 py-2 rounded-xl text-xs md:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${tab === 'active' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#0d1e35] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#1a2f4a] hover:bg-slate-50 dark:hover:bg-[#132540]'}`}>
          <Users size={13} />
          <span className="whitespace-nowrap">All Students ({activeStudents.length})</span>
        </button>
      </div>

      {/* Pending Tab */}
      {tab === 'pending' && (
        <div className="bg-white dark:bg-[#0f1f38] rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-50 dark:border-[#1a2f4a] flex items-center justify-between bg-blue-50/30 dark:bg-[#00c896]/5">
            <div className="flex items-center gap-2">
              <Clock className="text-blue-600 dark:text-[#00c896]" size={16} />
              <h3 className="text-sm md:text-lg font-bold text-slate-800 dark:text-white">Pending Registrations</h3>
            </div>
            <span className="text-[10px] md:text-xs font-bold text-blue-600 dark:text-[#00c896] px-2 py-0.5 bg-white dark:bg-[#0d1e35] rounded-full border border-blue-100 dark:border-[#1a2f4a] whitespace-nowrap">
              {pending.length} Requests
            </span>
          </div>
          {pending.length === 0 ? (
            <div className="text-center py-14 text-slate-400">
              <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pending registration requests.</p>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {pending.map(s => {
                const approving = actionLoading === s.id + 'approve';
                const rejecting = actionLoading === s.id + 'reject';
                return (
                  <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-[#0a1628]/60 rounded-2xl border border-dashed border-slate-200 dark:border-[#1a2f4a]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white dark:bg-[#0d1e35] flex items-center justify-center font-bold text-blue-600 dark:text-[#00c896] border border-slate-100 dark:border-[#1a2f4a] shadow-sm overflow-hidden shrink-0">
                        {s.user.image
                          ? <Image src={s.user.image} alt="" width={40} height={40} className="object-cover w-full h-full rounded-full" />
                          : s.user.name?.charAt(0) ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{s.user.name}</p>
                        <p className="text-[10px] text-slate-400">{s.user.email} • {timeAgo(s.user.createdAt)}</p>
                        <div className="mt-3 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">Code</span>
                            <span className="font-black text-slate-700 dark:text-slate-200 tracking-widest">#{s.studentCode}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">Department</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">{s.department.name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">Level</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              Level {s.academicYear}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAction(s.id, s.userId, 'approve')} disabled={!!actionLoading}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50">
                        {approving ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                      </button>
                      <button onClick={() => handleAction(s.id, s.userId, 'reject')} disabled={!!actionLoading}
                        className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50">
                        {rejecting ? <Loader2 size={20} className="animate-spin" /> : <XCircle size={20} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Active Students Table */}
      {tab === 'active' && (
        <div className="space-y-6">
          {/* Cards Grid */}
          {activeStudents.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeStudents
                .filter(s => s.user.name.toLowerCase().includes(search.toLowerCase()) || s.studentCode.includes(search))
                .map(s => {
                  const initials = s.user.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
                  return (
                    <button key={s.id} onClick={() => setSelectedStudent(s)}
                      className="bg-white dark:bg-[#0f1f38] p-5 rounded-2xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm hover:shadow-md hover:border-purple-200 dark:hover:border-purple-700 transition-all text-left group relative">
                      {/* 3-dot menu */}
                      <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setMenuOpen(menuOpen === s.id ? null : s.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#132540] rounded-lg transition-colors">
                          <MoreVertical size={16} />
                        </button>
                        {menuOpen === s.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                            <div className="absolute right-0 top-8 z-20 bg-white dark:bg-[#0d1e35] border border-slate-200 dark:border-[#1a2f4a] rounded-xl shadow-lg overflow-hidden w-36">
                              <button onClick={() => handleDelete(s.id)}
                                disabled={deleteLoading === s.id}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                {deleteLoading === s.id
                                  ? <Loader2 size={14} className="animate-spin" />
                                  : <XCircle size={14} />}
                                Delete Student
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 font-bold overflow-hidden shrink-0">
                          {s.user.image
                            ? <Image src={s.user.image} alt="" width={48} height={48} className="object-cover rounded-full" />
                            : initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-white text-sm truncate group-hover:text-purple-600 transition-colors">{s.user.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{s.user.email}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">Code</span>
                          <span className="font-black text-slate-700 dark:text-slate-200 tracking-widest">#{s.studentCode}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">Department</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{s.department.name}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">Level</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            Level {s.academicYear}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}

          {/* Analytics Table - only show if there are students */}
          {filteredAnalytics.length > 0 && (
          <div className="bg-white dark:bg-[#0f1f38] rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-[#0a1628]/60">
                    <th className="p-5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student Name</th>
                    <th className="p-5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance</th>
                    <th className="p-5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quiz Performance</th>
                    <th className="p-5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Meeting Presence</th>
                    <th className="p-5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="p-5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-[#1a2f4a]">
                  {filteredAnalytics.map(student => {
                    const status = getStatus(student.attendanceRate);
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-[#132540] transition-colors">
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-[#00c896] font-bold text-sm overflow-hidden shrink-0">
                              {student.image
                                ? <Image src={student.image} alt="" width={36} height={36} className="object-cover w-full h-full" />
                                : student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-white text-sm">{student.name}</p>
                              <p className="text-[11px] text-slate-400">{student.studentCode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-5 font-bold text-slate-700 dark:text-slate-200 text-sm">{student.attendanceRate}%</td>
                        <td className="p-5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 bg-slate-100 dark:bg-[#0a1628] rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${student.avgQuizScore}%` }} />
                            </div>
                            <span className="text-[12px] font-bold text-slate-600 dark:text-slate-300">{student.avgQuizScore}%</span>
                          </div>
                        </td>
                        <td className="p-5">
                          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-sm font-medium">
                            <Calendar size={14} className="text-[#00c896]" /> {student.quizRate}%
                          </span>
                        </td>
                        <td className="p-5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${status.cls}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button className="text-slate-400 hover:text-blue-600 transition-colors p-1">
                            <MoreVertical size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedStudent(null)}>
          <div className="bg-white dark:bg-[#0f1f38] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-[#00c896] dark:to-[#00a87e] p-4 text-white relative">
              <button onClick={() => setSelectedStudent(null)}
                className="absolute top-3 right-3 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <X size={16} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg overflow-hidden">
                  {selectedStudent.user.image
                    ? <Image src={selectedStudent.user.image} alt="" width={48} height={48} className="object-cover" />
                    : selectedStudent.user.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-base leading-tight">{selectedStudent.user.name}</h3>
                  <p className="text-white/70 text-xs mt-0.5">{selectedStudent.user.email}</p>
                  <span className="mt-0.5 inline-block text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">Student</span>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-[#0a1628]/60 rounded-xl">
                <Hash size={15} className="text-indigo-500 dark:text-[#00c896] shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Student Code</p>
                  <p className="font-black text-slate-800 dark:text-white text-base tracking-widest">{selectedStudent.studentCode}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-[#0a1628]/60 rounded-xl">
                <Building2 size={15} className="text-indigo-500 dark:text-[#00c896] shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Department</p>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">{selectedStudent.department.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-[#0a1628]/60 rounded-xl">
                <GraduationCap size={15} className="text-indigo-500 dark:text-[#00c896] shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Level</p>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">
                    Level {selectedStudent.academicYear}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-[#0a1628]/60 rounded-xl">
                <Mail size={15} className="text-indigo-500 dark:text-[#00c896] shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Email</p>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">{selectedStudent.user.email}</p>
                </div>
              </div>
              {selectedStudent.qrCode && (
                <div className="flex flex-col items-center gap-1.5 p-3 bg-slate-50 dark:bg-[#0a1628]/60 rounded-2xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                    <QrCode size={13} /> QR Code
                  </div>
                  <img src={selectedStudent.qrCode} alt="QR" className="w-24 h-24 rounded-xl" />
                  <p className="text-[10px] text-slate-400">Scan to verify student identity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
