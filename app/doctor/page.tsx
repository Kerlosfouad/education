'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BookOpen, HelpCircle, FileText, Calendar,
  UserPlus, Users, Loader2, CheckCircle2, XCircle,
  X, Hash, Building2, GraduationCap, QrCode, Mail,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface PendingStudent {
  id: string;
  userId: string;
  user: { name: string; email: string; createdAt: string };
}

interface StudentProgress {
  id: string;
  name: string;
  studentCode: string;
  attendanceRate: number;
}

interface StudentDetail {
  id: string;
  studentCode: string;
  academicYear: number;
  qrCode: string | null;
  user: { name: string; email: string; image: string | null };
  department: { name: string };
}

interface DashboardStats {
  subjectsCount: number;
  quizzesCount: number;
  assignmentsCount: number;
  attendanceRate: number;
}

function StudentsList({ students, onSelect }: { students: StudentDetail[]; onSelect: (s: StudentDetail) => void }) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 3;
  const visible = showAll ? students : students.slice(0, LIMIT);
  const hidden = students.length - LIMIT;

  return (
    <div className="space-y-3">
      {visible.map((s) => {
        const initials = s.user.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
        return (
          <button key={s.id} onClick={() => onSelect(s)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#132540] transition-colors text-left group">
            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-[#00c896]/15 flex items-center justify-center text-indigo-600 dark:text-[#00c896] font-bold text-sm shrink-0 overflow-hidden">
              {s.user.image
                ? <Image src={s.user.image} alt="" width={40} height={40} className="object-cover rounded-full" />
                : initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 dark:text-white text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-[#00c896] transition-colors">{s.user.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{s.department.name} • Year {s.academicYear}</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-[#0d1e35] px-2 py-1 rounded-lg shrink-0">#{s.studentCode}</span>
          </button>
        );
      })}

      {!showAll && hidden > 0 && (
        <button onClick={() => setShowAll(true)}
          className="w-full flex items-center gap-3 group">
          <div className="flex-1 h-px bg-slate-200 dark:bg-[#1a2f4a]" />
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-[#00c896] transition-colors px-3 whitespace-nowrap">
            +{hidden} More
          </span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-[#1a2f4a]" />
        </button>
      )}

      {showAll && students.length > LIMIT && (
        <button onClick={() => setShowAll(false)}
          className="w-full flex items-center gap-3 group">
          <div className="flex-1 h-px bg-slate-200 dark:bg-[#1a2f4a]" />
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-[#00c896] transition-colors px-3 whitespace-nowrap">
            Show Less
          </span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-[#1a2f4a]" />
        </button>
      )}
    </div>
  );
}

export default function DoctorDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pending, setPending] = useState<PendingStudent[]>([]);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [allStudents, setAllStudents] = useState<StudentDetail[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [subRes, quizRes, pendRes, studentsRes, statsRes] = await Promise.all([
        fetch('/api/subjects'),
        fetch('/api/quizzes'),
        fetch('/api/students/pending'),
        fetch('/api/students'),
        fetch('/api/doctor/stats'),
      ]);
      const [subJson, quizJson, pendJson, studentsJson, statsJson] = await Promise.all([
        subRes.json(), quizRes.json(), pendRes.json(), studentsRes.json(), statsRes.json(),
      ]);

      const analyticsData: any[] = [];

      setStats({
        subjectsCount: subJson.success ? subJson.data.length : 0,
        quizzesCount: quizJson.success ? quizJson.data.filter((q: any) => q.isPublished).length : 0,
        assignmentsCount: statsJson.success ? statsJson.data.totalAssignments : 0,
        attendanceRate: statsJson.success ? statsJson.data.attendanceRate : 0,
      });

      if (pendJson.success) setPending(pendJson.data);
      if (studentsJson.success) setAllStudents(studentsJson.data);

      const top5 = analyticsData
        .sort((a, b) => b.attendanceRate - a.attendanceRate)
        .slice(0, 5);
      setStudents(top5);
    } catch (e) {
      console.error(e);
    }
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
      if (json.success) setPending(prev => prev.filter(s => s.id !== studentId));
    } catch {}
    setActionLoading(null);
  };

  const statCards = stats ? [
    { label: 'Enrolled Subjects', value: stats.subjectsCount, sub: 'Active courses', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50', href: '/doctor/subjects' },
    { label: 'Published Quizzes', value: stats.quizzesCount, sub: 'This week', icon: HelpCircle, color: 'text-purple-600', bg: 'bg-purple-50', href: '/doctor/quizzes' },
    { label: 'Assignments', value: stats.assignmentsCount, sub: 'Need submission', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50', href: '/doctor/assignments' },
    { label: 'Attendance Rate', value: `${stats.attendanceRate}%`, sub: 'This semester', icon: Calendar, color: 'text-green-600', bg: 'bg-green-50', href: '/doctor/attendance' },
  ] : [];

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
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">Welcome back! 👋</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Here is a quick look at your students performance today.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Link key={i} href={stat.href} className="bg-white dark:bg-[#0f1f38] p-6 rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all group cursor-pointer block">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">{stat.label}</p>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{stat.value}</h3>
              </div>
              <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
                <stat.icon size={24} />
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{stat.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Pending Registrations */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0f1f38] p-4 md:p-8 rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 min-w-0">
              <UserPlus className="text-blue-600 dark:text-[#00c896] shrink-0" size={16} />
              <h3 className="text-xs md:text-xl font-bold text-slate-800 dark:text-white whitespace-nowrap">Pending Registrations</h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pending.length > 0 && (
                <button onClick={async () => {
                  if (!confirm(`Accept all ${pending.length} pending students?`)) return;
                  setActionLoading('accept-all');
                  try {
                    await Promise.all(pending.map(s => 
                      fetch('/api/students/approve', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ studentId: s.id, userId: s.userId, action: 'approve' }),
                      })
                    ));
                    fetchData();
                  } catch {}
                  setActionLoading(null);
                }}
                  disabled={!!actionLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap">
                  {actionLoading === 'accept-all' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Accept All
                </button>
              )}
              {pending.length > 0 && (
                <span className="text-xs font-bold text-blue-600 dark:text-[#00c896] bg-blue-50 dark:bg-[#00c896]/10 px-2 py-1 rounded-full whitespace-nowrap">
                  {pending.length} New
                </span>
              )}
            </div>
          </div>

          {pending.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pending registration requests.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map(student => {
                const approving = actionLoading === student.id + 'approve';
                const rejecting = actionLoading === student.id + 'reject';
                return (
                  <div key={student.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-slate-50/50 dark:bg-[#0a1628]/60 hover:bg-slate-50 dark:hover:bg-[#132540] rounded-2xl transition-colors group">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-white dark:bg-[#0d1e35] border border-slate-200 dark:border-[#1a2f4a] rounded-xl flex items-center justify-center font-bold text-blue-600 dark:text-[#00c896] shadow-sm shrink-0">
                        {student.user.name?.charAt(0) ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">{student.user.name}</h4>
                        <p className="text-[11px] text-slate-400 truncate">{student.user.email} • {timeAgo(student.user.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleAction(student.id, student.userId, 'approve')}
                        disabled={!!actionLoading}
                        className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 dark:bg-[#00c896] dark:text-[#0a1628] text-white text-[11px] font-bold rounded-xl hover:bg-blue-700 dark:hover:bg-[#00b085] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {approving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(student.id, student.userId, 'reject')}
                        disabled={!!actionLoading}
                        className="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-[#0d1e35] text-slate-400 border border-slate-200 dark:border-[#1a2f4a] text-[11px] font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {rejecting ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* All Students */}
        <div className="bg-white dark:bg-[#0f1f38] p-8 rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-indigo-500 dark:text-[#00c896]" size={20} />
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Students</h3>
            {allStudents.length > 0 && (
              <span className="ml-auto text-xs font-bold text-indigo-600 dark:text-[#00c896] bg-indigo-50 dark:bg-[#00c896]/10 px-3 py-1 rounded-full">
                {allStudents.length}
              </span>
            )}
          </div>

          {allStudents.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No approved students yet.</p>
            </div>
          ) : (
            <StudentsList students={allStudents} onSelect={setSelectedStudent} />
          )}
        </div>

      </div>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedStudent(null)}>
          <div className="bg-white dark:bg-[#0f1f38] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
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

            {/* Body */}
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
