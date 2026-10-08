'use client';

import { useEffect, useState } from 'react';
import {
  FileText, Clock, CheckCircle2, Loader2, Upload, X,
  Image as ImageIcon, Eye, ExternalLink
} from 'lucide-react';
import { useUploadThing } from '@/lib/uploadthing';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  startDate: string | null;
  deadline: string;
  maxScore: number;
  isActive: boolean;
  subject?: { id: string; name: string; code?: string } | null;
  submissions: { id: string; status: string; fileUrl: string | null; score: number | null; gradedAt: string | null }[];
}

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= 1024 * 1024) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" }));
                return;
              }
              resolve(file);
            },
            'image/jpeg',
            0.8
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ [id: string]: File }>({});
  const [progress, setProgress] = useState(0);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);

  const { startUpload } = useUploadThing('pdfUploader', {
    onUploadProgress: p => setProgress(p),
    onUploadError: (err) => {
      console.error('UploadThing Error:', err);
      setUploadError(err.message || 'حدث خطأ أثناء رفع الملف إلى الخادم');
    },
  });

  useEffect(() => {
    fetch('/api/student/assignments')
      .then(r => r.json())
      .then(json => { if (json.success) setAssignments(json.data); })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (assignmentId: string) => {
    const rawFile = selectedFile[assignmentId];
    if (!rawFile) return;

    if (rawFile.size === 0) {
      alert('الملف المختار فارغ. يرجى اختيار ملف صالح.');
      return;
    }

    if (rawFile.size > 20 * 1024 * 1024) {
      alert('حجم الملف يتجاوز الحد الأقصى المسموح به (20 ميجابايت). يرجى تقليل حجم الملف والمحاولة مرة أخرى.');
      return;
    }

    setUploadingId(assignmentId);
    setProgress(15);
    setUploadError(null);

    try {
      const file = await compressImageIfNeeded(rawFile);
      let finalFileUrl: string | null = null;

      // 1. Try UploadThing first
      try {
        const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || 'pdf' : 'pdf';
        const cleanFileName = `assignment_${assignmentId}_${Date.now()}.${ext}`;
        const safeFile = new File([file], cleanFileName, {
          type: file.type && file.type !== '' ? file.type : 'application/pdf',
        });

        const uploaded = await startUpload([safeFile]);
        if (uploaded?.[0]) {
          const uploadedData = uploaded[0] as any;
          finalFileUrl = uploadedData.ufsUrl || uploadedData.url || uploadedData.serverData?.url || null;
        }
      } catch (utError) {
        console.warn('UploadThing unavailable, using direct upload fallback:', utError);
      }

      // 2. If UploadThing did not succeed (e.g. quota limit, network error, 400), automatically use Direct Base64 upload
      if (!finalFileUrl) {
        if (file.size > 3.5 * 1024 * 1024) {
          throw new Error('تعذر رفع الملف وحجمه كبير جداً. يرجى تقليل حجم الملف إلى أقل من 3.5 ميجابايت والمحاولة مجدداً.');
        }
        setProgress(50);
        finalFileUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      }

      setProgress(85);

      // 3. Save submission to the database
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: finalFileUrl }),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch (err) {
        if (res.status === 413) {
          throw new Error('حجم الملف كبير جداً على السيرفر (Request Entity Too Large). يرجى تقليل حجم الملف.');
        }
        if (res.status === 403) {
          throw new Error('ليس لديك صلاحية لتسليم هذا التكليف (Forbidden).');
        }
        throw new Error(`خطأ في استجابة الخادم (${res.status})`);
      }

      if (res.ok && json?.success) {
        setProgress(100);
        setDoneId(assignmentId);
        setAssignments(prev => prev.map(a =>
          a.id === assignmentId
            ? { ...a, submissions: [{ id: json.data.id, status: 'SUBMITTED', fileUrl: finalFileUrl, score: null, gradedAt: null }] }
            : a
        ));
        setSelectedFile(prev => { const n = { ...prev }; delete n[assignmentId]; return n; });
      } else {
        alert(json?.error || 'فشل حفظ التسليم');
      }
    } catch (e: any) {
      console.error('Submission Error:', e);
      alert('حدث خطأ أثناء رفع وحفظ التسليم: ' + (e?.message || String(e)));
    } finally {
      setUploadingId(null);
    }
  };

  // Assignment is overdue if deadline has passed, regardless of isActive flag
  const isOverdue = (deadline: string) => new Date(deadline) < new Date();

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
        <p className="text-slate-500 dark:text-slate-400 mt-1">Check assignment sheets, instructions, and upload your submission before the deadline.</p>
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
            const overdue = isOverdue(a.deadline);
            const canSubmit = a.isActive && !submitted && !overdue;
            const isUploading = uploadingId === a.id;
            const file = selectedFile[a.id];
            const isDone = doneId === a.id || submitted;

            return (
              <div key={a.id} className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-800 dark:text-slate-100">{a.title}</h3>
                          {a.subject?.name && (
                            <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                              {a.subject.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={11} />
                          {a.startDate && (
                            <span>From: {new Date(a.startDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · </span>
                          )}
                          Due: {new Date(a.deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${
                      isDone ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : overdue ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300'
                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                    }`}>
                      {isDone ? 'Submitted' : overdue ? 'Overdue' : 'Pending'}
                    </span>
                  </div>

                  {/* Notes / Description */}
                  {a.description && (
                    <div className="mb-4 bg-slate-50 dark:bg-slate-700/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-600 text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
                      {a.description}
                    </div>
                  )}

                  {/* Attached Assignment Sheet (PDF or Image) from Doctor */}
                  {a.fileUrl && (
                    (a.fileUrl.startsWith('data:application/pdf') || a.fileUrl.toLowerCase().includes('.pdf') || a.fileUrl.toLowerCase().endsWith('.pdf')) ? (
                      <div className="mb-4 bg-red-50/40 dark:bg-red-950/20 rounded-2xl p-3.5 border border-red-200/60 dark:border-red-900/40 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                            <FileText size={20} className="text-red-600 dark:text-red-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">Assignment Sheet (PDF)</p>
                            <p className="text-[11px] text-slate-400">Attached instructions & document</p>
                          </div>
                        </div>
                        <a
                          href={a.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-bold bg-red-600 text-white hover:bg-red-700 px-3 py-2 rounded-xl transition-colors shadow-sm shrink-0"
                        >
                          <ExternalLink size={13} /> View PDF
                        </a>
                      </div>
                    ) : (
                      <div className="mb-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl p-3 border border-indigo-100 dark:border-indigo-900/40">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                            <ImageIcon size={14} className="text-indigo-600 dark:text-indigo-400" />
                            Assignment Sheet / Attached Image
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewModalUrl(a.fileUrl)}
                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <Eye size={12} /> Click to zoom
                          </button>
                        </div>
                        <div
                          onClick={() => setPreviewModalUrl(a.fileUrl)}
                          className="cursor-pointer overflow-hidden rounded-xl border border-indigo-200/60 dark:border-indigo-800 bg-black/5 dark:bg-black/20 max-h-52 flex items-center justify-center group relative"
                        >
                          <img
                            src={a.fileUrl}
                            alt={a.title}
                            className="w-full h-full max-h-52 object-contain group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="bg-black/75 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                              <Eye size={13} /> View Full Image
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* Submission Form / Status */}
                <div>
                  {!isDone && canSubmit && (
                    <div className="space-y-3 mt-2">
                      <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                        file ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                      }`}>
                        <input type="file" accept=".pdf,application/pdf,image/*" className="hidden"
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
                            <p className="text-xs text-slate-400">Click to upload your solution (PDF or Image)</p>
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
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-100 dark:shadow-none"
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
              </div>
            );
          })}
        </div>
      )}

      {/* Full-Screen Image Lightbox Modal for Students */}
      {previewModalUrl && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setPreviewModalUrl(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-3 right-3 z-10 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <img
              src={previewModalUrl}
              alt="Assignment Sheet Full View"
              className="max-w-full max-h-[82vh] object-contain rounded-lg"
            />
            <div className="mt-2 flex items-center gap-3">
              <a
                href={previewModalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <ExternalLink size={13} /> Open Original in New Tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
