'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CalendarCheck2, FileText, HelpCircle,
  Video, Library, CheckCircle2, Clock,
  BookOpen, ExternalLink, AlertCircle, Loader2,
  Phone, MessageCircle, Facebook, Instagram, Twitter, GraduationCap,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';

interface DashboardData {
  student: { id: string; name: string; email: string; studentCode: string; department: string; academicYear: number };
  doctor: { name: string; email: string; image: string; title: string; bio: string; phone: string; whatsapp: string; facebook: string; instagram: string; twitter: string };
  stats: { quizzesCount: number; assignmentsCount: number; attendanceRate: number; videosCount: number };
  quizzes: any[];
  assignments: any[];
  videos: any[];
  liveSessions: any[];
  libraryItems: any[];
  openSession: { id: string; title: string; subject: { name: string } } | null;
  alreadyMarked: boolean;
  unreadCount: number;
}

function AnnouncementsBanner({ studentDeptId }: { studentDeptId?: string }) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  useEffect(() => {
    fetch(`/api/student/announcements?page=dashboard`)
      .then(r => r.json())
      .then(j => { if (j.success) setAnnouncements(j.data); });
  }, []);
  if (!announcements.length) return null;
  return (
    <div className="space-y-3">
      {announcements.map((a: any) => (
        <div key={a.id} className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl overflow-hidden">
          {a.imageUrl && <img src={a.imageUrl} alt="" className="w-full h-40 object-cover" />}
          <div className="p-4 flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">📢</span>
            <div>
              <p className="font-black text-slate-800 dark:text-slate-100">{a.title}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{a.message}</p>
              <p className="text-xs text-slate-400 mt-1">{new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StudentDashboardPage() {  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceDone, setAttendanceDone] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/student/dashboard');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        // Don't auto-show modal - student will go to attendance page from notification
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 15000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const markAttendance = async () => {
    if (!data?.openSession) return;
    setAttendanceLoading(true);
    setAttendanceError('');
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: data.openSession.id }),
      });
      const json = await res.json();
      if (json.success) {
        setAttendanceDone(true);
        setTimeout(() => setShowAttendanceModal(false), 2000);
      } else {
        setAttendanceError(json.error || t('somethingWentWrong'));
      }
    } catch {
      setAttendanceError(t('networkErrorPleaseTryAgain'));
    }
    setAttendanceLoading(false);
  };

  const stats = data ? [
    { label: t('availableQuizzes'), value: data.stats.quizzesCount, icon: HelpCircle, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30', href: '/student/quizzes' },
    { label: t('pendingAssignments'), value: data.stats.assignmentsCount, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/30', href: '/student/assignments' },
    { label: t('attendanceRateLabel'), value: `${data.stats.attendanceRate}%`, icon: CalendarCheck2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/30', href: '/student/attendance' },
    { label: t('videosAvailable'), value: data.stats.videosCount, icon: Video, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30', href: '/student/videos' },
  ] : [];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  const academicYearLabel = ['', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6'];

  return (
    <>
      {/* Attendance Modal */}
      {showAttendanceModal && data?.openSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in-95 duration-300">
            {attendanceDone ? (
              <>
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="text-green-500" size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">{t('attendanceRecorded')}</h2>
                <p className="text-slate-500 dark:text-slate-400">{t('attendanceMarkedFor')} {data.openSession.subject?.name || data.openSession.title || 'Session'}</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarCheck2 className="text-indigo-600" size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">{t('markAttendance')}</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-1">{t('openAttendanceSession')}</p>
                <p className="text-indigo-600 font-bold text-lg mb-6">
                  {data.openSession.title || data.openSession.subject?.name || 'Attendance Session'}
                </p>
                {attendanceError && (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-xl px-4 py-3 mb-4 text-sm">
                    <AlertCircle size={16} /> {attendanceError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      if (data?.openSession) {
                        await fetch('/api/attendance/absent', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ sessionId: data.openSession.id }),
                        }).catch(() => {});
                      }
                      setShowAttendanceModal(false);
                    }}
                    className="flex-1 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {t('later')}
                  </button>
                  <button
                    onClick={markAttendance}
                    disabled={attendanceLoading}
                    className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {attendanceLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    {t('markAttendance')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="space-y-8 animate-in fade-in duration-700">
        {/* Header */}
        <div>
          <h2 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            {t('welcome')}, {data?.student.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
            {data?.student.department} &bull; {academicYearLabel[data?.student.academicYear ?? 0] || `Level ${data?.student.academicYear}`}
          </p>
        </div>

        {/* Announcements */}
        <AnnouncementsBanner studentDeptId={data?.student?.id} />

        {/* Doctor Info Card */}
        {data?.doctor && (
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-[#00c896] dark:to-[#00a87e] rounded-3xl p-6 text-white shadow-lg shadow-indigo-100 dark:shadow-none">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center font-black text-xl overflow-hidden shrink-0">
                {data.doctor.image
                  ? <Image src={data.doctor.image} alt="doctor" width={64} height={64} className="object-cover w-full h-full" unoptimized />
                  : data.doctor.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-lg leading-tight">{data.doctor.name}</p>
                {data.doctor.title && <p className="text-white/70 text-sm mt-0.5">{data.doctor.title}</p>}
                {data.doctor.bio && <p className="text-white/60 text-xs mt-1 line-clamp-2">{data.doctor.bio}</p>}
              </div>
            </div>
            {(data.doctor.phone || data.doctor.whatsapp || data.doctor.facebook || data.doctor.instagram || data.doctor.twitter) && (
              <div className="flex flex-wrap gap-2 mt-4">
                {data.doctor.phone && (
                  <a href={`tel:${data.doctor.phone}`}
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-xl text-xs font-bold">
                    <Phone size={13} /> {data.doctor.phone}
                  </a>
                )}
                {data.doctor.whatsapp && (
                  <a href={`https://wa.me/${data.doctor.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-xl text-xs font-bold">
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                )}
                {data.doctor.facebook && (
                  <a href={data.doctor.facebook.startsWith('http') ? data.doctor.facebook : `https://${data.doctor.facebook}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-xl text-xs font-bold">
                    <Facebook size={13} /> Facebook
                  </a>
                )}
                {data.doctor.instagram && (
                  <a href={data.doctor.instagram.startsWith('http') ? data.doctor.instagram : `https://instagram.com/${data.doctor.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-xl text-xs font-bold">
                    <Instagram size={13} /> Instagram
                  </a>
                )}
                {data.doctor.twitter && (
                  <a href={data.doctor.twitter.startsWith('http') ? data.doctor.twitter : `https://x.com/${data.doctor.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-xl text-xs font-bold">
                    <Twitter size={13} /> Twitter
                  </a>
                )}
              </div>
            )}
          </div>
        )}
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <Link key={i} href={stat.href}>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">{stat.label}</p>
                    <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stat.value}</h3>
                  </div>
                  <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
                    <stat.icon size={24} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quizzes */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <HelpCircle className="text-purple-500" size={20} />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('availableQuizzes')}</h3>
              </div>
              <Link href="/student/quizzes" className="text-xs text-indigo-600 font-bold hover:underline">{t('viewAll')}</Link>
            </div>
            <div className="space-y-3">
              {data?.quizzes.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">{t('noQuizzesAvailable')}</p>
              ) : data?.quizzes.map((quiz) => (
                <Link key={quiz.id} href={`/student/quizzes/${quiz.id}`}>
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-2xl transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center">
                        <HelpCircle className="text-purple-600" size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm group-hover:text-purple-600 transition-colors">{quiz.title}</p>
                        <p className="text-xs text-slate-400">{quiz.subject?.name} &bull; {quiz.timeLimit} min</p>
                      </div>
                    </div>
                    <span className="text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-bold px-3 py-1 rounded-full">{t('open')}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Assignments */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <FileText className="text-orange-500" size={20} />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Assignments</h3>
              </div>
              <Link href="/student/assignments" className="text-xs text-indigo-600 font-bold hover:underline">{t('viewAll')}</Link>
            </div>
            <div className="space-y-3">
              {data?.assignments.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">{t('noAssignmentsYet')}</p>
              ) : data?.assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 rounded-xl flex items-center justify-center">
                      <FileText className="text-orange-600" size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{a.title}</p>
                      <p className="text-xs text-slate-400">{a.subject?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-orange-600 font-bold">
                    <Clock size={12} />
                    {new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grades */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <GraduationCap className="text-indigo-500" size={20} />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">My Grades</h3>
              </div>
              <Link href="/student/grades" className="text-xs text-indigo-600 font-bold hover:underline">View all</Link>
            </div>
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
              <GraduationCap size={36} className="opacity-30" />
              <p className="text-sm">Check your grades page for detailed results</p>
              <Link href="/student/grades"
                className="mt-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                View Grades
              </Link>
            </div>
          </div>

          {/* Videos */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Video className="text-blue-500" size={20} />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Videos</h3>
              </div>
              <Link href="/student/videos" className="text-xs text-indigo-600 font-bold hover:underline">View all</Link>
            </div>
            <div className="space-y-3">
              {data?.videos.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No videos yet</p>
              ) : data?.videos.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                      <Video className="text-blue-600" size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{v.title}</p>
                      <p className="text-xs text-slate-400">{v.subject?.name}</p>
                    </div>
                  </div>
                  <a href={v.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold px-3 py-1 rounded-full hover:bg-blue-200 transition-colors">
                    Watch
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Library */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Library className="text-emerald-500" size={20} />
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">E-Library</h3>
            </div>
            <Link href="/student/library" className="text-xs text-indigo-600 font-bold hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.libraryItems.length === 0 ? (
              <p className="text-slate-400 text-sm col-span-3 text-center py-6">No books yet</p>
            ) : data?.libraryItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors group">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center shrink-0">
                  <BookOpen className="text-emerald-600" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate group-hover:text-emerald-600 transition-colors">{item.title}</p>
                  <p className="text-xs text-slate-400 truncate">{item.author || item.subject?.name}</p>
                </div>
                {(item.fileUrl || item.externalUrl) && (
                  <a href={item.fileUrl || item.externalUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-emerald-600 hover:text-emerald-700">
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
