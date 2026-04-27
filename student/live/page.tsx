'use client';

import { useEffect, useState } from 'react';
import { MonitorPlay, ExternalLink, Calendar, Clock, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  meetingUrl: string;
  scheduledAt: string;
  duration: number;
  isRecorded: boolean;
  recordingUrl: string | null;
  subject: { name: string };
}

export default function StudentLivePage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/student/live')
      .then(r => r.json())
      .then(json => { if (json.success) setSessions(json.data); })
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const upcoming = sessions.filter(s => new Date(s.scheduledAt) >= now);
  const past = sessions.filter(s => new Date(s.scheduledAt) < now);
  const displayed = tab === 'upcoming' ? upcoming : past;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black text-slate-800">{t('liveSessions')}</h2>
        <p className="text-slate-500 mt-1">{t('liveAndRecorded')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('upcoming')}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${tab === 'upcoming' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
          {t('upcoming')} ({upcoming.length})
        </button>
        <button onClick={() => setTab('past')}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${tab === 'past' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
          {t('past')} ({past.length})
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm text-center py-20">
          <MonitorPlay size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400">{tab === 'upcoming' ? t('noUpcomingSessions') : t('noPastSessions')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {displayed.map(s => {
            const isLive = Math.abs(new Date(s.scheduledAt).getTime() - now.getTime()) < 60 * 60 * 1000;
            return (
              <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isLive ? 'bg-red-100' : 'bg-slate-100'}`}>
                      <MonitorPlay className={isLive ? 'text-red-600' : 'text-slate-500'} size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{s.title}</h3>
                      <p className="text-xs text-slate-400">{s.subject.name}</p>
                    </div>
                  </div>
                  {isLive && tab === 'upcoming' && (
                    <span className="flex items-center gap-1 text-xs bg-red-100 text-red-600 font-bold px-3 py-1 rounded-full animate-pulse">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> LIVE
                    </span>
                  )}
                </div>

                {s.description && <p className="text-sm text-slate-500 mb-4 line-clamp-2">{s.description}</p>}

                <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(s.scheduledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(s.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <span>{s.duration} min</span>
                </div>

                <div className="flex gap-2">
                  {tab === 'upcoming' && (
                    <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm bg-red-500 text-white font-bold px-4 py-2 rounded-xl hover:bg-red-600 transition-colors">
                      <ExternalLink size={14} /> {t('joinSession')}
                    </a>
                  )}
                  {s.isRecorded && s.recordingUrl && (
                    <a href={s.recordingUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors">
                      <MonitorPlay size={14} /> {t('watchRecording')}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
