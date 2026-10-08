'use client';

import { useState, useEffect } from 'react';
import {
  Plus, FileText, ExternalLink, Users,
  History, X, Trash2, ChevronRight, Loader2, Search, Filter, Lock, Unlock, Check,
  Image as ImageIcon, Eye, Upload, FileCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { useUploadThing } from '@/lib/uploadthing';
import {
  getAssignmentsAction,
  createAssignmentAction,
  deleteAssignmentAction,
} from '@/actions/assignmentActions';

interface Submission {
  id: string;
  score: number | null;
  feedback: string | null;
  status: string;
  submittedAt: string;
  fileUrl: string | null;
  gradedAt: string | null;
  totalSubmissions: number;
  student: {
    id: string;
    studentCode: string;
    academicYear: number;
    user: { name: string; email: string };
    department: { name: string };
  };
}

interface AssignmentDetail {
  id: string;
  title: string;
  description?: string | null;
  maxScore: number;
  academicYear: number | null;
  fileUrl: string | null;
  subject: { name: string } | null;
  department: { name: string } | null;
  submissions: Submission[];
}

// Compress image if larger than 1MB to avoid upload bottleneck
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

function isPdfUrl(url?: string | null): boolean {
  if (!url) return false;
  return (
    url.startsWith('data:application/pdf') ||
    url.toLowerCase().includes('.pdf') ||
    url.toLowerCase().endsWith('.pdf')
  );
}

export default function AssignmentsPage() {
  const { t } = useI18n();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    departmentId: '',
    academicYear: '',
    semester: '1',
    subjectId: '',
    startDate: '',
    startTime: '00:00',
    endDate: '',
    endTime: '23:59',
    fileUrl: '',
  });

  // Attached file (image or PDF)
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Use pdfUploader which accepts pdf, blob, and image up to 16MB
  const { startUpload } = useUploadThing('pdfUploader');
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [allSubjects, setAllSubjects] = useState<{ id: string; name: string; code: string; departmentId: string; academicYear: number; semester: number }[]>([]);
  const [modalSubjects, setModalSubjects] = useState<{ id: string; name: string; code: string }[]>([]);
  const [modalLoadingSubjects, setModalLoadingSubjects] = useState(false);

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterAvailableLevels, setFilterAvailableLevels] = useState<{ value: string; label: string }[]>([]);

  // Details panel
  const [selected, setSelected] = useState<AssignmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Grading state
  const [maxScoreInput, setMaxScoreInput] = useState<string>('');
  const [updatingMaxScore, setUpdatingMaxScore] = useState(false);
  const [studentScores, setStudentScores] = useState<Record<string, string>>({});
  const [gradingLoading, setGradingLoading] = useState<string | null>(null);

  const academicYearsByDept: Record<string, { value: string; label: string }[]> = {
    PREP: [{ value: '0', label: 'Level 0' }],
    default: [
      { value: '1', label: 'Level 1' },
      { value: '2', label: 'Level 2' },
      { value: '3', label: 'Level 3' },
      { value: '4', label: 'Level 4' },
    ],
  };
  const selectedDept = departments.find(d => d.id === newAssignment.departmentId);
  const academicYears = selectedDept?.code === 'PREP'
    ? academicYearsByDept['PREP']
    : academicYearsByDept['default'];

  useEffect(() => {
    refreshData();
    fetch('/api/subjects/departments').then(r => r.json()).then(j => { if (j.success) setDepartments(j.data); });
    fetch('/api/subjects').then(r => r.json()).then(j => { if (j.success) setAllSubjects(j.data); });
  }, []);

  useEffect(() => {
    if (!filterDept) { setFilterAvailableLevels([]); setFilterLevel(''); return; }
    const dept = departments.find(d => d.name === filterDept);
    if (dept?.code === 'PREP') {
      setFilterAvailableLevels([{ value: '0', label: 'Level 0' }]);
      setFilterLevel('0');
    } else {
      setFilterAvailableLevels([1,2,3,4].map(l => ({ value: String(l), label: `Level ${l}` })));
      setFilterLevel('');
    }
  }, [filterDept, departments]);

  // Fetch subjects for the create modal when department, year, or semester changes
  useEffect(() => {
    if (!newAssignment.departmentId || newAssignment.academicYear === '') {
      setModalSubjects([]);
      setNewAssignment(prev => ({ ...prev, subjectId: '' }));
      return;
    }
    setModalLoadingSubjects(true);
    const params = new URLSearchParams({
      departmentId: newAssignment.departmentId,
      academicYear: newAssignment.academicYear,
      semester: newAssignment.semester,
    });
    fetch(`/api/subjects?${params.toString()}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setModalSubjects(j.data || []);
          // If current subjectId is not in new list, reset it
          if (newAssignment.subjectId && !j.data.some((s: any) => s.id === newAssignment.subjectId)) {
            setNewAssignment(prev => ({ ...prev, subjectId: '' }));
          }
        }
      })
      .catch(() => setModalSubjects([]))
      .finally(() => setModalLoadingSubjects(false));
  }, [newAssignment.departmentId, newAssignment.academicYear, newAssignment.semester]);

  // Available subjects for the filter dropdown
  const filteredSubjectsForDropdown = allSubjects.filter(s => {
    if (filterDept) {
      const dept = departments.find(d => d.name === filterDept);
      if (dept && s.departmentId !== dept.id) return false;
    }
    if (filterLevel && String(s.academicYear) !== filterLevel) return false;
    if (filterSemester && String(s.semester) !== filterSemester) return false;
    return true;
  });

  const filteredAssignments = assignments.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || (a.subject?.name && a.subject.name.toLowerCase().includes(search.toLowerCase()));
    const matchDept = !filterDept || a.department?.name === filterDept;
    const matchLevel = !filterLevel || String(a.academicYear) === filterLevel;
    const matchSemester = !filterSemester || String(a.semester) === filterSemester;
    const matchSubject = !filterSubject || a.subjectId === filterSubject || a.subject?.id === filterSubject;
    return matchSearch && matchDept && matchLevel && matchSemester && matchSubject;
  });

  const refreshData = async () => {
    const data = await getAssignmentsAction();
    if (data) setAssignments(data);
  };

  const openDetails = async (id: string) => {
    setDetailLoading(true);
    setSelected(null);
    const res = await fetch(`/api/assignments/${id}`);
    const json = await res.json();
    if (json.success) {
      setSelected(json.data);
      setMaxScoreInput(String(json.data.maxScore));
      const initialScores: Record<string, string> = {};
      json.data.submissions.forEach((s: Submission) => {
        initialScores[s.id] = s.score !== null ? String(s.score) : String(json.data.maxScore);
      });
      setStudentScores(initialScores);
    }
    setDetailLoading(false);
  };

  const handleCreateClick = () => {
    setAttachedFile(null);
    setFilePreview('');
    setFileType(null);
    setIsModalOpen(true);
  };

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPdf) {
      toast.error('Please select an Image (PNG, JPG, WEBP) or a PDF file');
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      toast.error('File size must be less than 16MB');
      return;
    }

    setAttachedFile(file);
    if (isImage) {
      setFileType('image');
      const localUrl = URL.createObjectURL(file);
      setFilePreview(localUrl);
    } else {
      setFileType('pdf');
      setFilePreview(file.name);
    }
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    setFilePreview('');
    setFileType(null);
    setNewAssignment(p => ({ ...p, fileUrl: '' }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignment.departmentId || newAssignment.academicYear === '' || newAssignment.academicYear === undefined) {
      toast.error('Please select department and academic year');
      return;
    }
    if (!newAssignment.subjectId) {
      toast.error('Please select a subject for this assignment');
      return;
    }
    setLoading(true);
    try {
      let finalFileUrl: string | null = newAssignment.fileUrl || null;

      // If an attached file was selected, upload it
      if (attachedFile) {
        try {
          const fileToUpload = await compressImageIfNeeded(attachedFile);
          const ext = fileToUpload.name.includes('.') ? fileToUpload.name.split('.').pop()?.toLowerCase() || 'pdf' : 'pdf';
          const cleanFileName = `assignment_${Date.now()}.${ext}`;
          const safeFile = new File([fileToUpload], cleanFileName, {
            type: fileToUpload.type && fileToUpload.type !== '' ? fileToUpload.type : (fileType === 'pdf' ? 'application/pdf' : 'image/jpeg'),
          });

          const uploaded = await startUpload([safeFile]);
          if (uploaded?.[0]) {
            const uploadedData = uploaded[0] as any;
            finalFileUrl = uploadedData.ufsUrl || uploadedData.url || uploadedData.serverData?.url || null;
          }
        } catch (utErr) {
          console.warn('UploadThing upload error, falling back to base64:', utErr);
        }

        // Base64 fallback if UploadThing is offline or failed
        if (!finalFileUrl) {
          if (attachedFile.size > 4 * 1024 * 1024) {
            toast.error('File upload failed and file is too large for fallback. Please reduce file size under 4MB.');
            setLoading(false);
            return;
          }
          finalFileUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(attachedFile);
          });
        }
      }

      const startDate = newAssignment.startDate && newAssignment.startTime
        ? new Date(`${newAssignment.startDate}T${newAssignment.startTime}`).toISOString()
        : new Date().toISOString();
      const deadline = new Date(`${newAssignment.endDate}T${newAssignment.endTime}`).toISOString();
      
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAssignment.title,
          description: newAssignment.description || null,
          fileUrl: finalFileUrl,
          departmentId: newAssignment.departmentId,
          academicYear: parseInt(newAssignment.academicYear),
          semester: parseInt(newAssignment.semester),
          subjectId: newAssignment.subjectId,
          startDate,
          deadline,
        }),
      });

      const res = await response.json();

      if (response.ok && res.success) {
        setIsModalOpen(false);
        setNewAssignment({
          title: '',
          description: '',
          departmentId: '',
          academicYear: '',
          semester: '1',
          subjectId: '',
          startDate: '',
          startTime: '00:00',
          endDate: '',
          endTime: '23:59',
          fileUrl: '',
        });
        setAttachedFile(null);
        setFilePreview('');
        setFileType(null);
        refreshData();
        toast.success(attachedFile ? 'Assignment published successfully with attached sheet!' : 'Assignment published successfully!');
      } else {
        toast.error('Error: ' + res.error);
      }
    } catch (err: any) {
      console.error('Save assignment error:', err);
      toast.error('Failed to publish assignment: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assignment?')) return;
    await fetch(`/api/assignments/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    refreshData();
    if (selected?.id === id) setSelected(null);
  };

  const handleToggleActive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/assignments/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toggle: true }) });
    refreshData();
  };

  const handleUpdateMaxScore = async () => {
    if (!maxScoreInput || maxScoreInput.trim() === '') {
      toast.error('Please enter a max score');
      return;
    }
    const newMaxScore = Number(maxScoreInput);
    if (isNaN(newMaxScore) || newMaxScore <= 0) {
      toast.error('Max score must be a positive number');
      return;
    }

    setUpdatingMaxScore(true);
    try {
      const res = await fetch(`/api/assignments/${selected?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxScore: newMaxScore }),
      });
      const json = await res.json();
      if (json.success) {
        if (selected) await openDetails(selected.id);
        toast.success('Max score updated successfully!');
      } else {
        toast.error('Error: ' + (json.error || 'Failed to update'));
      }
    } catch (error) {
      toast.error('Error updating max score');
    }
    setUpdatingMaxScore(false);
  };

  const handleGradeSubmission = async (submissionId: string, customScore?: number) => {
    if (!selected) return;
    
    let scoreToSubmit: number;
    if (customScore !== undefined) {
      scoreToSubmit = customScore;
    } else {
      const raw = studentScores[submissionId];
      if (raw === undefined || raw.trim() === '') {
        scoreToSubmit = selected.maxScore;
      } else {
        scoreToSubmit = Number(raw);
      }
    }

    if (isNaN(scoreToSubmit) || scoreToSubmit < 0) {
      toast.error('Please enter a valid non-negative score');
      return;
    }

    if (scoreToSubmit > selected.maxScore) {
      toast.error(`Score cannot exceed max score (${selected.maxScore})`);
      return;
    }
    
    setGradingLoading(submissionId);
    try {
      const res = await fetch(`/api/assignments/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, score: scoreToSubmit }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Score saved (${scoreToSubmit}/${selected.maxScore})`);
        await openDetails(selected.id);
      } else {
        toast.error(json.error || 'Failed to grade');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error grading submission');
    }
    setGradingLoading(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Assignments</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('createAssignmentsAndGrade')}</p>
        </div>
        <button onClick={handleCreateClick}
          className="flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none transition-all w-fit text-sm">
          <Plus size={18} /> {t('createNewAssignment')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignment List */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="text-indigo-500" size={20} />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('allAssignments')}</h3>
          </div>

          {/* Filter Bar on Assignments */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
            <div className="relative flex-1 min-w-[120px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input type="text" placeholder="Search..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 pr-2.5 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setFilterLevel(''); setFilterSubject(''); }}
              className="px-2.5 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="">All Depts</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
            <select value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setFilterSubject(''); }}
              className="px-2.5 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="">All Levels</option>
              {filterAvailableLevels.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <select value={filterSemester} onChange={e => { setFilterSemester(e.target.value); setFilterSubject(''); }}
              className="px-2.5 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="">All Semesters</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
              className="px-2.5 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[140px] truncate">
              <option value="">All Subjects</option>
              {filteredSubjectsForDropdown.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {(filterDept || filterLevel || filterSemester || filterSubject || search) && (
              <button onClick={() => { setFilterDept(''); setFilterLevel(''); setFilterSemester(''); setFilterSubject(''); setSearch(''); }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 transition-colors">
                <X size={12} /> Reset
              </button>
            )}
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs sm:text-sm">{assignments.length === 0 ? t('noAssignmentsYet') : 'No assignments match filters'}</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredAssignments.map(a => {
                const isNew = Date.now() - new Date(a.createdAt).getTime() < 24 * 60 * 60 * 1000;
                const isSelected = selected?.id === a.id;
                return (
                  <div key={a.id}
                    className={`flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700'
                        : 'bg-slate-50 dark:bg-slate-700/40 border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700'
                    }`}
                    onClick={() => openDetails(a.id)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex-shrink-0 flex items-center justify-center ${isNew ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-slate-600'}`}>
                        <FileText size={16} className={isNew ? 'text-green-600' : 'text-slate-400'} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate">{a.title}</p>
                          {a.subject?.name && (
                            <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-md">
                              {a.subject.name}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {a.department?.name ? `${a.department.name} • L${a.academicYear ?? ''} • S${a.semester ?? ''} • ` : ''}
                          {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &bull; {a._count?.submissions ?? 0} subs
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isNew && <span className="text-[9px] font-black bg-green-100 dark:bg-green-900/30 text-green-600 px-1.5 py-0.5 rounded-full">New</span>}
                      <button onClick={e => { e.stopPropagation(); handleToggleActive(a.id, e); }}
                        title={a.isActive ? 'Close assignment' : 'Open assignment'}
                        className={`p-1.5 rounded-lg transition-colors ${a.isActive ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        {a.isActive ? <Unlock size={14} /> : <Lock size={14} />}
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                      <ChevronRight size={15} className={`text-slate-300 transition-transform ${isSelected ? 'rotate-90 text-indigo-500' : ''}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Details Panel */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 sm:p-6">
          {detailLoading ? (
            <div className="flex items-center justify-center h-full min-h-[180px]">
              <Loader2 className="animate-spin text-indigo-500" size={28} />
            </div>
          ) : !selected ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-slate-400">
              <ChevronRight size={36} className="opacity-20 mb-2" />
              <p className="text-xs sm:text-sm">Select an assignment to view submissions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Assignment header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base sm:text-lg">{selected.title}</h3>
                    {selected.subject?.name && (
                      <span className="text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                        {selected.subject.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selected.department
                      ? `${selected.department.name}${selected.academicYear !== null && selected.academicYear !== undefined ? ` • Level ${selected.academicYear}` : ''}`
                      : 'All Students'}
                    {' • Max score: '}{selected.maxScore}
                  </p>
                </div>

                {selected.fileUrl && (
                  isPdfUrl(selected.fileUrl) ? (
                    <a
                      href={selected.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 font-bold px-3 py-1.5 rounded-xl hover:bg-red-100 transition-colors border border-red-200/60 dark:border-red-800 shrink-0"
                    >
                      <FileText size={14} className="text-red-500" /> View PDF
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPreviewModalUrl(selected.fileUrl)}
                      className="flex items-center gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 font-bold px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-200/60 dark:border-indigo-800 shrink-0"
                    >
                      <ImageIcon size={14} /> View Image
                    </button>
                  )
                )}
              </div>

              {/* Attached Sheet / Document Display */}
              {selected.fileUrl && (
                isPdfUrl(selected.fileUrl) ? (
                  <div className="bg-red-50/40 dark:bg-red-950/20 rounded-xl p-3 border border-red-200/60 dark:border-red-900/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-red-600 dark:text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">Attached Assignment Sheet (PDF)</p>
                        <p className="text-[10px] text-slate-400">PDF Document provided for students</p>
                      </div>
                    </div>
                    <a
                      href={selected.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 hover:underline bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 shadow-sm shrink-0"
                    >
                      <ExternalLink size={12} /> Open PDF
                    </a>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-600">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <ImageIcon size={13} /> Assignment Image / Sheet
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewModalUrl(selected.fileUrl)}
                        className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-0.5"
                      >
                        <Eye size={12} /> Click to zoom
                      </button>
                    </div>
                    <div
                      onClick={() => setPreviewModalUrl(selected.fileUrl)}
                      className="cursor-pointer overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-900/5 max-h-44 flex items-center justify-center group"
                    >
                      <img
                        src={selected.fileUrl}
                        alt={selected.title}
                        className="w-full h-full max-h-44 object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  </div>
                )
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl sm:rounded-2xl p-2.5 text-center">
                  <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">{selected.submissions.length}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Submitted</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl sm:rounded-2xl p-2.5 text-center">
                  <p className="text-xl sm:text-2xl font-black text-green-700 dark:text-green-400">{selected.submissions.filter(s => s.status === 'GRADED').length}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Graded</p>
                </div>
              </div>

              {/* Submissions list */}
              {selected.submissions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs sm:text-sm">{t('noSubmissionsYet')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Max Score Input */}
                  <div className="flex items-end gap-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl sm:rounded-2xl p-2.5 border border-indigo-200 dark:border-indigo-800">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1 block">
                        Max Score (current: {selected.maxScore})
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder={String(selected.maxScore)}
                        value={maxScoreInput}
                        onChange={e => setMaxScoreInput(e.target.value)}
                        className="w-full bg-white dark:bg-slate-700 border border-indigo-300 dark:border-indigo-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      onClick={handleUpdateMaxScore}
                      disabled={updatingMaxScore || maxScoreInput === String(selected.maxScore)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0">
                      {updatingMaxScore ? <Loader2 size={12} className="animate-spin" /> : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Set
                    </button>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto pr-1 space-y-3">
                  {/* Group by department + year */}
                  {Object.entries(
                    selected.submissions
                      .reduce((groups, sub) => {
                      const key = `${sub.student.department?.name ?? 'General'} - Level ${sub.student.academicYear}`;
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(sub);
                      return groups;
                    }, {} as Record<string, Submission[]>)
                  ).map(([groupKey, subs]) => (
                    <div key={groupKey}>
                      <p className="text-[11px] font-black text-slate-400 uppercase mb-1.5 px-1">{groupKey}</p>
                      <div className="space-y-2">
                        {subs.map(sub => (
                          <div key={sub.id} className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-2.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                  {sub.student.user.name?.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">{sub.student.user.name}</p>
                                  <p className="text-[11px] text-slate-400">{sub.student.studentCode} · {new Date(sub.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                </div>
                              </div>
                              {sub.fileUrl ? (
                                <div className="flex gap-1">
                                  <a href={sub.fileUrl.startsWith('data:') ? `/api/assignments/submissions/${sub.id}/file` : sub.fileUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[11px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors">
                                    <ExternalLink size={10} /> View
                                  </a>
                                  <span className="flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold px-2 py-1 rounded-lg">
                                    <FileText size={10} /> {sub.totalSubmissions}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded-full">No file</span>
                              )}
                            </div>
                            
                            {/* Grading Section */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5 bg-white dark:bg-slate-800/80 rounded-lg p-2 border border-slate-200/80 dark:border-slate-600/60">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Score:</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max={selected.maxScore}
                                    step="any"
                                    placeholder={String(selected.maxScore)}
                                    value={studentScores[sub.id] ?? (sub.score !== null ? String(sub.score) : String(selected.maxScore))}
                                    onChange={e => setStudentScores(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                    className="w-16 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-1.5 py-0.5 text-xs font-black text-slate-800 dark:text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                  <span className="text-[11px] font-bold text-slate-400">/ {selected.maxScore}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                {sub.status === 'GRADED' && (
                                  <span className="text-[9px] font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
                                    Saved ({sub.score})
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleGradeSubmission(sub.id)}
                                  disabled={gradingLoading === sub.id}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[11px] font-bold transition-colors disabled:opacity-50"
                                  title="Save specific score for this student"
                                >
                                  {gradingLoading === sub.id ? (
                                    <Loader2 size={11} className="animate-spin" />
                                  ) : (
                                    <Check size={11} />
                                  )}
                                  {sub.status === 'GRADED' ? 'Update' : 'Save'}
                                </button>
                                {sub.status !== 'GRADED' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStudentScores(prev => ({ ...prev, [sub.id]: String(selected.maxScore) }));
                                      handleGradeSubmission(sub.id, selected.maxScore);
                                    }}
                                    disabled={gradingLoading === sub.id}
                                    className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-[11px] font-bold transition-colors disabled:opacity-50"
                                    title="Approve with full max score"
                                  >
                                    Full ({selected.maxScore})
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal - Compact Mobile Optimized */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm sm:max-w-md md:max-w-lg rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xl animate-in zoom-in duration-200 max-h-[92vh] flex flex-col my-auto border border-slate-100 dark:border-slate-700">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">Create Assignment</h3>
                  <p className="text-[10px] text-slate-400">Publish task, deadline & sheet</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="space-y-2 sm:space-y-2.5 pt-2.5 overflow-y-auto pr-0.5">
              <div>
                <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">Assignment Title *</label>
                <input required
                  className="w-full bg-slate-50 dark:bg-slate-700/60 dark:text-slate-100 border border-slate-200/90 dark:border-slate-600 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="e.g., Week 5 Quiz / Assignment 2"
                  value={newAssignment.title}
                  onChange={e => setNewAssignment({ ...newAssignment, title: e.target.value })}
                />
              </div>

              {/* Department & Academic Year in 2 Columns on Mobile */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">Department *</label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-slate-700/60 dark:text-slate-100 border border-slate-200/90 dark:border-slate-600 rounded-xl px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newAssignment.departmentId}
                    onChange={e => setNewAssignment(p => ({ ...p, departmentId: e.target.value, academicYear: '' }))}
                  >
                    <option value="">Select dept...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">Level *</label>
                  <select
                    required
                    disabled={!newAssignment.departmentId}
                    className="w-full bg-slate-50 dark:bg-slate-700/60 dark:text-slate-100 border border-slate-200/90 dark:border-slate-600 rounded-xl px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
                    value={newAssignment.academicYear}
                    onChange={e => setNewAssignment(p => ({ ...p, academicYear: e.target.value }))}
                  >
                    <option value="">Select year...</option>
                    {academicYears.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Semester & Subject in 2 Columns */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">Semester *</label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-slate-700/60 dark:text-slate-100 border border-slate-200/90 dark:border-slate-600 rounded-xl px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newAssignment.semester}
                    onChange={e => setNewAssignment(p => ({ ...p, semester: e.target.value }))}
                  >
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 flex items-center justify-between">
                    <span>Subject *</span>
                    {modalLoadingSubjects && <Loader2 size={10} className="animate-spin text-indigo-500" />}
                  </label>
                  <select
                    required
                    disabled={!newAssignment.departmentId || newAssignment.academicYear === '' || modalLoadingSubjects}
                    className="w-full bg-slate-50 dark:bg-slate-700/60 dark:text-slate-100 border border-slate-200/90 dark:border-slate-600 rounded-xl px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50 truncate"
                    value={newAssignment.subjectId}
                    onChange={e => setNewAssignment(p => ({ ...p, subjectId: e.target.value }))}
                  >
                    <option value="">
                      {!newAssignment.departmentId || newAssignment.academicYear === ''
                        ? 'Select dept/level...'
                        : modalLoadingSubjects
                        ? 'Loading...'
                        : modalSubjects.length === 0
                        ? 'No subjects'
                        : 'Select subject...'}
                    </option>
                    {modalSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start Date & Time */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">Start Date & Time *</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <input required type="date"
                    className="col-span-2 bg-slate-50 dark:bg-slate-700/60 dark:text-slate-100 border border-slate-200/90 dark:border-slate-600 rounded-xl px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newAssignment.startDate}
                    onChange={e => setNewAssignment({ ...newAssignment, startDate: e.target.value })}
                  />
                  <input required type="time"
                    className="col-span-1 bg-slate-50 dark:bg-slate-700/60 dark:text-slate-100 border border-slate-200/90 dark:border-slate-600 rounded-xl px-1.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none text-center"
                    value={newAssignment.startTime}
                    onChange={e => setNewAssignment({ ...newAssignment, startTime: e.target.value })}
                  />
                </div>
              </div>

              {/* End Date & Time */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">End Date (Deadline) *</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <input required type="date"
                    className="col-span-2 bg-slate-50 dark:bg-slate-700/60 dark:text-slate-100 border border-slate-200/90 dark:border-slate-600 rounded-xl px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newAssignment.endDate}
                    onChange={e => setNewAssignment({ ...newAssignment, endDate: e.target.value })}
                  />
                  <input required type="time"
                    className="col-span-1 bg-slate-50 dark:bg-slate-700/60 dark:text-slate-100 border border-slate-200/90 dark:border-slate-600 rounded-xl px-1.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none text-center"
                    value={newAssignment.endTime}
                    onChange={e => setNewAssignment({ ...newAssignment, endTime: e.target.value })}
                  />
                </div>
              </div>

              {/* File Attachment: Supports PDF and Images */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Upload size={12} className="text-indigo-500" /> Attached Sheet (PDF or Image)
                  </span>
                  {attachedFile && (
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="text-[10px] text-red-500 hover:text-red-700 font-bold flex items-center gap-0.5"
                    >
                      <Trash2 size={10} /> Remove
                    </button>
                  )}
                </label>

                {attachedFile ? (
                  <div className="p-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${fileType === 'pdf' ? 'bg-red-100 text-red-600 dark:bg-red-900/40' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40'}`}>
                        {fileType === 'pdf' ? <FileText size={16} /> : <ImageIcon size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{attachedFile.name}</p>
                        <p className="text-[10px] text-slate-400">{(attachedFile.size / (1024 * 1024)).toFixed(2)} MB • {fileType === 'pdf' ? 'PDF Document' : 'Image Sheet'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {fileType === 'image' && filePreview && (
                        <button
                          type="button"
                          onClick={() => setPreviewModalUrl(filePreview)}
                          className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-indigo-700 transition-colors"
                        >
                          <Eye size={10} /> View
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 w-full h-14 sm:h-16 border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-700/40 transition-colors px-3">
                    <input
                      type="file"
                      accept=".pdf,application/pdf,image/*,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                      onChange={e => handleFileSelect(e.target.files?.[0])}
                    />
                    <Upload size={16} className="text-indigo-500 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">Attach Assignment PDF or Image</p>
                      <p className="text-[10px] text-slate-400">PDF, PNG, JPG, WEBP (Up to 16MB)</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Optional Notes/Description */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">Notes / Description (Optional)</label>
                <textarea
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-700/60 dark:text-slate-100 border border-slate-200/90 dark:border-slate-600 rounded-xl px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                  placeholder="Instructions or remarks for students..."
                  value={newAssignment.description}
                  onChange={e => setNewAssignment({ ...newAssignment, description: e.target.value })}
                />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold mt-2 hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs sm:text-sm">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {loading ? 'Publishing...' : 'Save & Publish Assignment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Full-Screen Image Lightbox Modal */}
      {previewModalUrl && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
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
              alt="Assignment full view"
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
