'use client';

import { useEffect, useState } from 'react';
import { FileText, Clock, CheckCircle2, Loader2, Upload, X } from 'lucide-react';
import { useUploadThing } from '@/lib/uploadthing';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  maxScore: number;
  isActive: boolean;
  submissions: { id: string; status: string; fileUrl: string | null; score: number | null; gradedAt: string | null }[];
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ [id: string]: File }>({});
  const [progress, setProgress] = useState(0);
  const [doneId, setDoneId] = useState<string | null>(null);

  const { startUpload } = useUploadThing('pdfUploader', {
    onUploadProgress: p => setProgress(p),
  });

  useEffect(() => {
    fetch('/api/student/assignments')
      .then(r => r.json())
      .then(json => { if (json.success) setAssignments(json.data); })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (assignmentId: string) => {
    const file = selectedFile[assignmentId];
    if (!file) return;
    setUploadingId(assignmentId);
    setProgress(0);
    try {
      const uploaded = await startUpload([file]);
      if (!uploaded?.[0]) { alert('Upload failed'); return; }

      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: uploaded[0].url }),
      });
      const json = await res.json();
      if (json.success) {
        setDoneId(assignmentId);
        setAssignments(prev => prev.map(a =>
          a.id === assignmentId
            ? { ...a, submissions: [{ id: json.data.id, status: 'SUBMITTED', fileUrl: uploaded[0].url, score: null, gradedAt: null }] }
            : a
        ));
        setSelectedFile(prev => { const n = { ...prev }; delete n[assignmentId]; return n; });
      } else {
        alert(json.error || 'Submission failed');
      }
    } catch (e) {
      alert('Error: ' + String(e));
    }
    setUploadingId(null);
  };

  const isOverdue = (deadline: string, isActive: boolean) => !isActive && new Date(deadline) < new Date();

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <AnnouncementBanner page="assignments" />
      <div>
        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">Assignments</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Upload your PDF and submit before the deadline.</p>
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
            const overdue = isOverdue(a.deadline, a.isActive);
            const canSubmit = a.isActive && !submitted;
            const isUploading = uploadingId === a.id;
            const file = selectedFile[a.id];
            const isDone = doneId === a.id || submitted;

            return (
              <div key={a.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      isDone ? 'bg-green-100 dark:bg-green-900/40'
                      : overdue ? 'bg-red-100 dark:bg-red-900/40'
                      : 'bg-orange-100 dark:bg-orange-900/40'
                    }`}>
                      {isDone
                        ? <CheckCircle2 className="text-green-600" size={22} />
                        : <FileText className={overdue ? 'text-red-500' : 'text-orange-600'} size={22} />
                      }
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">{a.title}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock size={11} />
                        Deadline: {new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    isDone ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                    : overdue ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300'
                    : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                  }`}>
                    {isDone ? 'Submitted' : overdue ? 'Overdue' : 'Pending'}
                  </span>
                </div>

                {!isDone && canSubmit && (
                  <div className="space-y-3">
                    <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                      file ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                    }`}>
                      <input type="file" accept=".pdf" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) setSelectedFile(prev => ({ ...prev, [a.id]: f }));
                        }} />
                      {file ? (
                        <div className="text-center">
                          <FileText className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                          <p className="text-xs font-medium text-indigo-600">{file.name}</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                          <p className="text-xs text-slate-400">Click to upload PDF</p>
                        </div>
                      )}
                    </label>

                    {isUploading && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Uploading...</span><span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleSubmit(a.id)}
                      disabled={!file || isUploading}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {isUploading ? `Uploading ${progress}%...` : 'Submit Assignment'}
                    </button>
                  </div>
                )}

                {isDone && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-3">
                      <CheckCircle2 className="text-green-600 shrink-0" size={18} />
                      <p className="text-sm font-bold text-green-700 dark:text-green-400">Assignment submitted successfully</p>
                    </div>
                    {a.submissions[0]?.status === 'GRADED' && a.submissions[0]?.score !== null && (
                      <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-4 py-3">
                        <div>
                          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Grade</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {a.submissions[0].gradedAt && new Date(a.submissions[0].gradedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{a.submissions[0].score}</p>
                          <p className="text-xs text-slate-400">/ {a.maxScore}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
