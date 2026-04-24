'use client';

import { useState, useEffect } from 'react';
import { Video, Plus, Copy, Check, Trash2, ExternalLink, Calendar, Clock, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  meetingUrl: string;
  scheduledAt: string;
  duration: number;
  subject: { name: string };
}

interface Subject { id: string; name: string; }

export default function LecturesPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', subjectId: '', meetingUrl: '', scheduledAt: '', duration: '60' });

  useEffect(() => {
    Promise.all([
      fetch('/api/live').then(r => r.json()),
      fetch('/api/subjects').then(r => r.json()),
    ]).then(([liveJson, subJson]) => {
      if (liveJson.success) setSessions(liveJson.data);
      if (subJson.success) setSubjects(subJson.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const copyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.meetingUrl || !form.scheduledAt || !form.subjectId) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          subjectId: form.subjectId,
          meetingUrl: form.meetingUrl,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          duration: Number(form.duration),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSessions(prev => [json.data, ...prev]);
        setShowForm(false);
        setForm({ title: '', description: '', subjectId: '', meetingUrl: '', scheduledAt: '', duration: '60' });
        toast.success('Live session scheduled');
      } else {
        toast.error(json.error || 'Failed to create session');
      }
    } catch { toast.error('Network error'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    await fetch(`/api/live?id=${id}`, { method: 'DELETE' });
    setSessions(prev => prev.filter(s => s.id !== id));
    toast.success('Session deleted');
  };

  const now = new Date();
  const upcoming = sessions.filter(s => new Date(s.scheduledAt) >= now);
  const past = sessions.filter(s => new Date(s.scheduledAt) < now);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Live Lectures</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Schedule and manage live sessions for your students.</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none transition-all w-fit">
          <Plus size={20} /> Schedule Session
        </button>
      </div>

      {/* Quick start card */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-[#00c896] dark:to-[#00a87e] rounded-3xl p-6 text-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
            <Video size={28} />
          </div>
          <div>
            <p className="font-black text-lg">Start an instant meeting</p>
            <p className="text-white/70 text-sm">Open Google Meet and copy the link to share with students</p>
          </div>
        </div>
        <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap">
          <ExternalLink size={16} /> Open Meet
        </a>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-3 text-sm uppercase tracking-wider">Upcoming ({upcoming.length})</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {upcoming.map(s => (
              <SessionCard key={s.id} session={s} copied={copied} onCopy={copyLink} onDelete={handleDelete} isUpcoming />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 className="font-bold text-slate-500 mb-3 text-sm uppercase tracking-wider">Past ({past.length})</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {past.map(s => (
              <SessionCard key={s.id} session={s} copied={copied} onCopy={copyLink} onDelete={handleDelete} isUpcoming={false} />
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="bg-white dark:bg-[#0f1f38] rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm text-center py-20">
          <Video size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400 font-medium">No sessions yet. Schedule your first live lecture.</p>
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Schedule Live Session</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 flex items-center justify-center text-slate-500">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Title *</label>
                <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Chapter 5 - Lecture"
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Subject *</label>
                <select required value={form.subjectId} onChange={e => setForm(p => ({ ...p, subjectId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  <option value="">Select subject...</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Meeting URL *</label>
                <input required value={form.meetingUrl} onChange={e => setForm(p => ({ ...p, meetingUrl: e.target.value }))}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Date & Time *</label>
                  <input required type="datetime-local" value={form.scheduledAt} onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Duration (min)</label>
                  <input type="number" min="15" value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} placeholder="Optional..."
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {saving ? 'Saving...' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, copied, onCopy, onDelete, isUpcoming }: {
  session: LiveSession;
  copied: string | null;
  onCopy: (url: string, id: string) => void;
  onDelete: (id: string) => void;
  isUpcoming: boolean;
}) {
  return (
    <div className="bg-white dark:bg-[#0f1f38] p-5 rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isUpcoming ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-slate-100 dark:bg-[#0a1628]/60'}`}>
            <Video className={isUpcoming ? 'text-indigo-600' : 'text-slate-400'} size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">{session.title}</h3>
            <p className="text-xs text-slate-400">{session.subject.name}</p>
          </div>
        </div>
        <button onClick={() => onDelete(session.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
        <span className="flex items-center gap-1"><Calendar size={11} />{new Date(session.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span className="flex items-center gap-1"><Clock size={11} />{new Date(session.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
        <span>{session.duration} min</span>
      </div>
      <div className="flex gap-2">
        <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-bold px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors">
          <ExternalLink size={12} /> Open
        </a>
        <button onClick={() => onCopy(session.meetingUrl, session.id)}
          className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${copied === session.id ? 'bg-green-100 text-green-700' : 'bg-slate-100 dark:bg-[#0a1628]/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}>
          {copied === session.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Link</>}
        </button>
      </div>
    </div>
  );
}
