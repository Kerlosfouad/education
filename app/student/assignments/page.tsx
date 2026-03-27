'use client';

import { useEffect, useState } from 'react';
import { FileText, Clock, CheckCircle2, Upload, Loader2, ExternalLink } from 'lucide-react';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  maxScore: number;
  fileUrl: string | null;
  subject: { name: string } | null;
  submissions: { id: string; status: string; score: number | null; fileUrl: string | null }[];
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/assignments')
      .then(r => r.text())
      .then(text => {
        if (!text) return;
        const json = JSON.parse(text);
        if (json.success) setAssignments(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isOverdue = (deadline: string) => new Date(deadline) < new Date();

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">Assignments</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">All your pending and submitted assignments</p>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm text-center py-20">
          <FileText size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400">No assignments yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {assignments.map(a => {
            const submitted = a.submissions.length > 0;
            const sub = a.submissions[0];
            const overdue = isOverdue(a.deadline);
            return (
              <div key={a.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      submitted ? 'bg-green-100 dark:bg-green-900/40'
                      : overdue ? 'bg-red-100 dark:bg-red-900/40'
                      : 'bg-orange-100 dark:bg-orange-900/40'
                    }`}>
                      {submitted
                        ? <CheckCircle2 className="text-green-600" size={22} />
                        : <FileText className={overdue ? 'text-red-500' : 'text-orange-600'} size={22} />
                      }
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">{a.title}</h3>
                      <p className="text-xs text-slate-400">{a.subject?.name ?? 'General'}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    submitted ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                    : overdue ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                    : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                  }`}>
                    {submitted ? 'Submitted' : overdue ? 'Overdue' : 'Pending'}
                  </span>
                </div>

                {a.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{a.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    Deadline: {new Date(a.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                  <span>Max score: {a.maxScore}</span>
                </div>

                {submitted && sub.score !== null && (
                  <div className="bg-green-50 dark:bg-green-900/30 rounded-2xl px-4 py-2 text-sm text-green-700 dark:text-green-300 font-bold mb-3">
                    Your score: {sub.score} / {a.maxScore}
                  </div>
                )}

                <div className="flex gap-2">
                  {a.fileUrl && (
                    <a
                      href={a.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        // mark as submitted when student opens the form
                        if (!submitted) {
                          fetch(`/api/assignments/${a.id}`, { method: 'POST' }).catch(() => {});
                        }
                      }}
                      className="flex items-center gap-1 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold px-3 py-2 rounded-xl hover:bg-indigo-200 transition-colors">
                      <ExternalLink size={12} /> Open Assignment
                    </a>
                  )}
                  {submitted && sub.fileUrl && (
                    <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold px-3 py-2 rounded-xl hover:bg-green-200 transition-colors">
                      <Upload size={12} /> Your submission
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
