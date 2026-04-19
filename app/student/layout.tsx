'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard, CalendarCheck2, FileText, HelpCircle,
  Video, Library, LogOut, Menu, X, MonitorPlay,
  Bell, GraduationCap, Sun, Moon, QrCode, Hash, Building2, BookOpen, Download, FileDown,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';
import { LOGO_BASE64 } from '@/lib/logo';

interface Notification {
  id: string; title: string; message: string;
  type: string; isRead: boolean; createdAt: string;
}

interface StudentProfile {
  studentCode: string;
  qrCode: string | null;
  academicYear: number;
  phone: string | null;
  user: { name: string; email: string; image: string | null };
  department: { name: string };
}

interface DoctorInfo {
  name: string; email: string; image: string; title: string; bio: string;
  phone: string; whatsapp: string; facebook: string; instagram: string; twitter: string;
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showStudentCard, setShowStudentCard] = useState(false);
  const [showDoctorCard, setShowDoctorCard] = useState(false);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  const isDark = mounted && theme === 'dark';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  const menuItems = [
    { icon: LayoutDashboard, label: t('dashboard'),     path: '/student/dashboard' },
    { icon: CalendarCheck2,  label: t('attendance'),    path: '/student/attendance' },
    { icon: FileText,        label: t('assignments'),   path: '/student/assignments' },
    { icon: HelpCircle,      label: t('quizzes'),       path: '/student/quizzes' },
    { icon: GraduationCap,   label: 'Grades',           path: '/student/grades' },
    { icon: Video,           label: t('videos'),        path: '/student/videos' },
    { icon: Library,         label: t('eLibrary'),      path: '/student/library' },
  ];

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data);
        setUnreadCount(json.data.filter((n: Notification) => !n.isRead).length);
      }
    } catch {}
  }, []);

  const openProfile = async () => {
    setShowProfile(true);
    if (!profile) {
      const res = await fetch('/api/student/profile');
      const json = await res.json();
      if (json.success) setProfile(json.data);
    }
  };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    fetch('/api/doctor/settings')
      .then(r => r.json())
      .then(json => { if (json.success) setDoctorInfo(json.data); })
      .catch(() => {});
  }, []);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: null }) }).catch(() => {});
  };

  const markOneRead = (id: string) => {
    const wasUnread = notifications.some(n => n.id === id && !n.isRead);
    if (!wasUnread) return;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
  };

  const getNotificationHref = (n: Notification) => {
    if (n.type === 'ASSIGNMENT') return '/student/assignments';
    if (n.type === 'QUIZ') return '/student/quizzes';
    if (n.type === 'ATTENDANCE') return '/student/attendance';
    if (n.type === 'EXAM_RESULT') return '/student/dashboard';

    // ANNOUNCEMENT/GENERAL fallback using message hints
    const content = `${n.title} ${n.message}`.toLowerCase();
    if (content.includes('assignment')) return '/student/assignments';
    if (content.includes('quiz')) return '/student/quizzes';
    if (content.includes('video')) return '/student/videos';
    if (content.includes('live') || content.includes('session') || content.includes('lecture')) return '/student/live';
    if (content.includes('library') || content.includes('book')) return '/student/library';
    return '/student/dashboard';
  };

  const openNotification = (n: Notification) => {
    markOneRead(n.id);
    setShowNotifications(false);
    router.push(getNotificationHref(n));
  };

  const notifIcon: Record<string, string> = {
    QUIZ: 'Q', ASSIGNMENT: 'A', ATTENDANCE: 'C',
    ANNOUNCEMENT: 'N', EXAM_RESULT: 'E', GENERAL: 'G',
  };

  const studentName = session?.user?.name || 'Student';
  const studentEmail = session?.user?.email || '';
  const initials = studentName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const doctorName = doctorInfo?.name || 'Dr. Emad';
  const doctorInitials = doctorName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const yearLabels: Record<number, string> = {
    1: 'Level 1', 2: 'Level 2', 3: 'Level 3', 4: 'Level 4', 5: 'Level 5',
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] dark:bg-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/60 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-50 dark:border-slate-700/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
            <Image src={LOGO_BASE64} alt="logo" width={32} height={32} className="w-full h-full object-cover" unoptimized />
          </div>
          <h1 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{doctorName}</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-[14px] group ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600'}`}>
                <item.icon size={20} className={`${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button onClick={openProfile} className="flex items-center gap-3 overflow-hidden hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0 overflow-hidden">
                {session?.user?.image ? <Image src={session.user.image} alt="avatar" width={40} height={40} className="rounded-full object-cover" /> : initials}
              </div>
              <div className="flex flex-col overflow-hidden text-left">
                <span className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">{studentName}</span>
                <span className="text-[10px] text-slate-400 truncate">{studentEmail}</span>
              </div>
            </button>
            <button onClick={() => signOut({ callbackUrl: '/auth/login' })} title="Logout"
              className="shrink-0 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <main className="flex-1 min-w-0">
        <div className="relative lg:hidden p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 flex justify-between items-center sticky top-0 z-30">
          <h1 className="font-bold text-indigo-600">{doctorName}</h1>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="relative p-2 bg-slate-50 rounded-lg text-slate-600" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell size={20} />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-4 top-16 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          markAllRead();
                        }}
                        className="text-xs text-indigo-600 hover:underline font-medium"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700">
                    {notifications.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-8">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => openNotification(n)}
                          className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors ${
                            n.isRead
                              ? 'bg-white dark:bg-slate-800'
                              : 'bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-50'
                          }`}
                        >
                          <span className="text-xl shrink-0">{notifIcon[n.type] || 'N'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${n.isRead ? 'text-slate-600' : 'text-slate-800'}`}>{n.title}</p>
                            <p className="text-xs text-slate-400 truncate">{n.message}</p>
                          </div>
                          {!n.isRead && <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 mt-1" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
            <button className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-end gap-2 px-10 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 sticky top-0 z-30">
          <button onClick={toggleTheme} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="relative">
            <button className="relative p-2 bg-slate-50 rounded-xl text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell size={22} />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">Notifications</span>
                  {unreadCount > 0 && <button onMouseDown={(e) => { e.preventDefault(); markAllRead(); }} className="text-xs text-indigo-600 hover:underline font-medium">Mark all read</button>}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700">
                  {notifications.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-8">No notifications</p>
                  ) : notifications.map((n) => (
                    <div key={n.id} onClick={() => openNotification(n)}
                      className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors ${n.isRead ? 'bg-white dark:bg-slate-800' : 'bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-50'}`}>
                      <span className="text-xl shrink-0">{notifIcon[n.type] || 'N'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${n.isRead ? 'text-slate-600' : 'text-slate-800'}`}>{n.title}</p>
                        <p className="text-xs text-slate-400 truncate">{n.message}</p>
                      </div>
                      {!n.isRead && <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 mt-1" />}
                    </div>
                  ))}
                </div>
              </div>
              </>
            )}
          </div>
        </div>

        
        <div className="p-4 md:p-8 lg:p-10">{children}</div>
      </main>

      {showProfile && (        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowProfile(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-[#00c896] dark:to-[#00a87e] p-6 text-white relative">
              <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <X size={16} />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                  {session?.user?.image ? <Image src={session.user.image} alt="avatar" width={64} height={64} className="object-cover" /> : initials}
                </div>
                <div>
                  <h3 className="font-black text-lg leading-tight">{profile?.user.name || studentName}</h3>
                  <p className="text-white/70 text-xs mt-0.5">{profile?.user.email || studentEmail}</p>
                  <span className="mt-1 inline-block text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">Student</span>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {!profile ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <Hash size={16} className="text-indigo-600 dark:text-[#00c896] shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Student Code</p>
                        <p className="font-black text-slate-800 dark:text-slate-100 text-lg tracking-widest">{profile.studentCode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <Building2 size={16} className="text-indigo-600 dark:text-[#00c896] shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Department</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{profile.department.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <BookOpen size={16} className="text-indigo-600 dark:text-[#00c896] shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Academic Year</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{`Level ${profile.academicYear}`}</p>
                      </div>
                    </div>
                  </div>
                  {profile.qrCode && (
                    <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">
                        <QrCode size={14} /> QR Code
                      </div>
                      <img src={profile.qrCode} alt="QR Code" className="w-36 h-36 rounded-xl" />
                      <p className="text-[10px] text-slate-400">Scan to verify student identity</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowProfile(false); window.open('/api/student/download-pdf', '_blank'); }}
                      className="flex items-center gap-2 flex-1 justify-center py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-colors"
                    >
                      <Download size={16} /> Registration
                    </button>
                    <button
                      onClick={() => { setShowProfile(false); window.open('/api/student/download-cards', '_blank'); }}
                      className="flex items-center gap-2 flex-1 justify-center py-2.5 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white font-bold text-sm rounded-xl transition-colors"
                    >
                      <Download size={16} /> 6 Cards
                    </button>
                  </div>                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showStudentCard && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowStudentCard(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm my-4" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-indigo-600 dark:bg-[#00c896] p-5 rounded-t-3xl text-white text-center relative">
              <button onClick={() => setShowStudentCard(false)} className="absolute top-3 right-3 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <X size={16} />
              </button>
              <p className="font-black text-base">Dr. Emad Bayoume Platform</p>
              <p className="text-white/80 text-xs mt-0.5">Student Registration Card</p>
            </div>

            {/* Info rows */}
            <div className="px-5 pt-4 divide-y divide-slate-100 dark:divide-slate-700">
              {[
                ['FULL NAME',     profile.user.name],
                ['STUDENT CODE',  profile.studentCode],
                ['DEPARTMENT',    profile.department.name],
                ['ACADEMIC YEAR', `Level ${profile.academicYear}`],
                ['PHONE',         profile.phone || '-'],
                ['EMAIL',         profile.user.email],
                ['STATUS',        'Approved ✓'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 text-right max-w-[60%] break-all">{value}</span>
                </div>
              ))}
            </div>

            {/* QR */}
            {profile.qrCode && (
              <div className="mx-5 my-4 p-4 bg-blue-50 dark:bg-slate-700/50 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-600 text-center">
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2">QR CODE</p>
                <img src={profile.qrCode} alt="QR" className="w-36 h-36 mx-auto" />
                <p className="text-[10px] text-slate-400 mt-2">Scan to verify student identity</p>
              </div>
            )}

            <p className="text-center text-[10px] text-slate-400 pb-3">Please print this form and submit it to your professor.</p>

            {/* Save as PDF button */}
            <div className="px-5 pb-5">
              <a
                href="/api/student/download-pdf"
                download
                className="flex items-center gap-2 w-full justify-center py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-[#00c896] dark:hover:bg-[#00a87e] text-white font-bold text-sm rounded-xl transition-colors"
              >
                <FileDown size={16} /> Save as PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}