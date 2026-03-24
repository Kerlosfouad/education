'use client';

import { useEffect, useState, useCallback } from 'react';
import { CalendarCheck2, CheckCircle2, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  timestamp: string;
  verificationMethod: string;
  session: {
    title: string | null;
    openTime: string;
    subject: { name: string };
  } | null;
}

interface OpenSession {
  id: string;
  title: string | null;
  subject: { name: string };
  closeTime: string;
}

export default function StudentAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ attended: 0, absent: 0, total: 0, rate: 0 });
  const [openSession, setOpenSession] = useState<OpenSession | null>(null);
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState('');
  const [markDone, setMarkDone] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [recRes, statsRes, dashRes] = await Promise.all([
        fetch('/api/attendance'),
        fetch('/api/student/attendance/stats'),
        fetch('/api/student/dashboard'),
      ]);
      const [recJson, statsJson, dashJson] = await Promise.all([
        recRes.json(), statsRes.json(), dashRes.json(),
      ]);
      if (recJson.success) setRecords(recJson.data);
      if (statsJson.success) setStats(statsJson.data);
      if (dashJson.success) {
        setOpenSession(dashJson.data.openSession);
        setAlreadyMarked(dashJson.data.alreadyMarked);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const markAttendance = async () => {
    if (!openSession) return;
    setMarking(true);
    setMarkError('');
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: openSession.id }),
      });
      const json = await res.json();
      if (json.success) {
        setMarkDone(true);
        setAlreadyMarked(true);
        fetchAll();
      } else {
        setMarkError(json.error || 'An error occurred');
      }
    } catch {
      setMarkError('Connection error');
    }
    setMarking(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  const validRecords = records.filter(r => r.session != null);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black text-slate-800">Attendance</h2>
        <p className="text-slate-500 mt-1">Track your attendance across all lectures.</p>
      </div>

      {/* Open Session Banner */}
      {openSession && (
        <div className={`rounded-3xl p-6 border-2 ${alreadyMarked || markDone ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-200'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${alreadyMarked || markDone ? 'bg-green-100' : 'bg-indigo-100'}`}>
                {alreadyMarked || markDone
                  ? <CheckCircle2 className="text-green-600" size={28} />
                  : <CalendarCheck2 className="text-indigo-600" size={28} />}
              </div>
              <div>
                <p className="font-black text-slate-800 text-lg">
                  {alreadyMarked || markDone ? 'Attendance recorded' : 'Attendance session is open'}
                </p>
                <p className="text-slate-500 text-sm">
                  {openSession.title || openSession.subject?.name} &bull;{' '}
                  closes at {new Date(openSession.closeTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            {!alreadyMarked && !markDone && (
              <div className="flex flex-col gap-2">
                {markError && (
                  <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-xl">
                    <AlertCircle size={14} /> {markError}
                  </div>
                )}
                <button
                  onClick={markAttendance}
                  disabled={marking}
                  className="flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  {marking ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  {marking ? 'Marking...' : 'Mark Attendance'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
          <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="text-green-600" size={28} />
          </div>
          <p className="text-3xl font-black text-slate-800">{stats.attended}</p>
          <p className="text-slate-400 text-sm mt-1">Lectures attended</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <XCircle className="text-red-500" size={28} />
          </div>
          <p className="text-3xl font-black text-slate-800">{stats.absent ?? (stats.total - stats.attended)}</p>
          <p className="text-slate-400 text-sm mt-1">Lectures missed</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CalendarCheck2 className="text-indigo-600" size={28} />
          </div>
          <p className="text-3xl font-black text-slate-800">{stats.rate}%</p>
          <p className="text-slate-400 text-sm mt-1">Attendance rate</p>
        </div>
      </div>

      {/* Records */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <h3 className="font-bold text-slate-800">Attendance Record</h3>
        </div>
        {validRecords.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CalendarCheck2 size={48} className="mx-auto mb-3 opacity-30" />
            <p>No attendance records yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {validRecords.map(r => {
              const isAbsent = r.verificationMethod === 'ABSENT';
              return (
                <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAbsent ? 'bg-red-100' : 'bg-green-100'}`}>
                      {isAbsent
                        ? <XCircle className="text-red-500" size={18} />
                        : <CheckCircle2 className="text-green-600" size={18} />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{r.session!.title || r.session!.subject?.name}</p>
                      <p className="text-xs text-slate-400">{r.session!.subject?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAbsent ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                      {isAbsent ? 'Absent' : 'Present'}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={12} />
                      {new Date(r.session!.openTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
