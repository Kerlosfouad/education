'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard, Users, Calendar, ClipboardList,
  HelpCircle, Video, Library, GraduationCap,
  BarChart3, Settings, Menu, LogOut, MonitorPlay, Sun, Moon,
  X, Phone, MessageCircle, Facebook, Instagram, Twitter,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';

interface DoctorProfile {
  name: string; email: string; image: string;
  title: string; bio: string;
  phone: string; whatsapp: string; facebook: string; instagram: string; twitter: string;
}

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch('/api/doctor/settings')
      .then(r => r.json())
      .then(json => { if (json.success) setProfile(json.data); })
      .catch(() => {});
  }, []);

  const isDark = mounted && theme === 'dark';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  const doctorName = profile?.name || 'EDUBRIDGE';
  const doctorEmail = profile?.email || '';
  const initials = doctorName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const menuItems = [
    { icon: LayoutDashboard, label: t('dashboard'),     path: '/doctor' },
    { icon: Users,           label: t('students'),      path: '/doctor/students' },
    { icon: Calendar,        label: t('attendance'),    path: '/doctor/attendance' },
    { icon: ClipboardList,   label: t('assignments'),   path: '/doctor/assignments' },
    { icon: HelpCircle,      label: t('quizzes'),       path: '/doctor/quizzes' },
    { icon: MonitorPlay,     label: t('liveSessions'),  path: '/doctor/lectures' },
    { icon: Video,           label: t('videos'),        path: '/doctor/videos' },
    { icon: Library,         label: t('eLibrary'),      path: '/doctor/libbooks' },
    { icon: GraduationCap,   label: t('results'),       path: '/doctor/results' },
    { icon: BarChart3,       label: t('analytics'),     path: '/doctor/analytics' },
    { icon: Settings,        label: t('settings'),      path: '/doctor/settings' },
  ];

  return (
    <div className="flex min-h-screen bg-[#f8fafc] dark:bg-slate-900">
      {/* Sidebar — same classes as student layout so CSS overrides apply */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/60 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        <div className="p-6 border-b border-slate-50 dark:border-slate-700/60 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <GraduationCap size={18} />
          </div>
          <h1 className="font-bold text-slate-800 dark:text-slate-100 text-lg tracking-wide">{doctorName}</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-[14px] group ${isActive
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600'
                }`}>
                <item.icon size={20} className={`${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button onClick={() => setShowProfileCard(true)} className="flex items-center gap-3 overflow-hidden hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-[#00c896]/15 flex items-center justify-center text-indigo-600 dark:text-[#00c896] font-bold text-sm shrink-0 overflow-hidden">
                {profile?.image
                  ? <Image src={profile.image} alt="avatar" width={40} height={40} className="rounded-full object-cover" />
                  : initials}
              </div>
              <div className="flex flex-col overflow-hidden text-left">
                <span className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">{doctorName}</span>
                <span className="text-[10px] text-slate-400 truncate">{doctorEmail}</span>
              </div>
            </button>
            <button onClick={() => signOut({ callbackUrl: '/auth/login' })} title="Logout"
              className="shrink-0 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 flex justify-between items-center sticky top-0 z-30">
          <h1 className="font-bold text-indigo-600 tracking-wide">{doctorName}</h1>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
          </div>
        </div>

        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center justify-end px-10 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 sticky top-0 z-30">
          <button onClick={toggleTheme}
            className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="p-4 md:p-8 lg:p-10">{children}</div>
      </main>

      {/* Doctor Profile Card Modal */}
      {showProfileCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowProfileCard(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-[#00c896] dark:to-[#00a87e] p-6 text-white relative">
              <button onClick={() => setShowProfileCard(false)}
                className="absolute top-4 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <X size={16} />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-xl overflow-hidden">
                  {profile?.image
                    ? <Image src={profile.image} alt="avatar" width={64} height={64} className="object-cover w-full h-full" />
                    : initials}
                </div>
                <div>
                  <h3 className="font-black text-lg leading-tight">{doctorName}</h3>
                  {profile?.title && <p className="text-white/80 text-xs mt-0.5">{profile.title}</p>}
                  <p className="text-white/60 text-xs mt-0.5">{doctorEmail}</p>
                </div>
              </div>
              {profile?.bio && <p className="mt-4 text-white/70 text-xs leading-relaxed">{profile.bio}</p>}
            </div>

            <div className="p-6 space-y-3">
              {!profile?.phone && !profile?.whatsapp && !profile?.facebook && !profile?.instagram && !profile?.twitter ? (
                <p className="text-center text-slate-400 text-sm py-4">No contact info added yet.</p>
              ) : (
                <>
                  {profile?.phone && (
                    <a href={`tel:${profile.phone}`}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-[#00c896]/10 dark:hover:bg-[#00c896]/10 transition-colors group">
                      <div className="w-9 h-9 bg-[#00c896]/15 rounded-xl flex items-center justify-center text-[#00c896] group-hover:scale-110 transition-transform">
                        <Phone size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Phone</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{profile.phone}</p>
                      </div>
                    </a>
                  )}
                  {profile?.whatsapp && (
                    <a href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors group">
                      <div className="w-9 h-9 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                        <MessageCircle size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">WhatsApp</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{profile.whatsapp}</p>
                      </div>
                    </a>
                  )}
                  {profile?.facebook && (
                    <a href={profile.facebook.startsWith('http') ? profile.facebook : `https://${profile.facebook}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group">
                      <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center text-blue-700 group-hover:scale-110 transition-transform">
                        <Facebook size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Facebook</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{profile.facebook}</p>
                      </div>
                    </a>
                  )}
                  {profile?.instagram && (
                    <a href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors group">
                      <div className="w-9 h-9 bg-pink-100 dark:bg-pink-900/40 rounded-xl flex items-center justify-center text-pink-600 group-hover:scale-110 transition-transform">
                        <Instagram size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Instagram</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{profile.instagram}</p>
                      </div>
                    </a>
                  )}
                  {profile?.twitter && (
                    <a href={profile.twitter.startsWith('http') ? profile.twitter : `https://x.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors group">
                      <div className="w-9 h-9 bg-sky-100 dark:bg-sky-900/40 rounded-xl flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform">
                        <Twitter size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">X (Twitter)</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{profile.twitter}</p>
                      </div>
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
