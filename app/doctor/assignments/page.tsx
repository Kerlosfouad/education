'use client';

import { useState, useEffect } from 'react';
import {
  Plus, FileText, ExternalLink, Users,
  History, X, Trash2, ChevronRight, Loader2, Search, Filter, Lock, Unlock, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
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
  maxScore: number;
  academicYear: number | null;
  fileUrl: string | null;
  subject: { name: string } | null;
  department: { name: string } | null;
  submissions: Submission[];
}

export default function AssignmentsPage() {
  const { t } = useI18n();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    departmentId: '',
    academicYear: '',
    semester: '1',
    subjectId: '',
    startDate: '',
    startTime: '00:00',
    endDate: '',
    endTime: '23:59',
  });
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
    setIsModalOpen(true);
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
    const startDate = newAssignment.startDate && newAssignment.startTime
      ? new Date(`${newAssignment.startDate}T${newAssignment.startTime}`).toISOString()
      : new Date().toISOString();
    const deadline = new Date(`${newAssignment.endDate}T${newAssignment.endTime}`).toISOString();
    const res = await createAssignmentAction({
      title: newAssignment.title,
      departmentId: newAssignment.departmentId,
      academicYear: parseInt(newAssignment.academicYear),
      semester: parseInt(newAssignment.semester),
      subjectId: newAssignment.subjectId,
      startDate,
      deadline,
    });
    if (res.success) {
      setIsModalOpen(false);
      setNewAssignment({
        title: '',
        departmentId: '',
        academicYear: '',
        semester: '1',
        subjectId: '',
        startDate: '',
        startTime: '00:00',
        endDate: '',
        endTime: '23:59',
      });
      refreshData();
      toast.success('Assignment published successfully!');
    } else {
      toast.error('Error: ' + res.error);
    }
    setLoading(false);
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
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none transition-all w-fit">
          <Plus size={20} /> {t('createNewAssignment')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignment List */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
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
              <div className="flex items-start justify-between">
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
                  <a href={selected.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-bold px-2.5 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors">
                    <ExternalLink size={12} /> Form
                  </a>
                )}
              </div>

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

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl animate-in zoom-in duration-200 max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">New Assignment</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-2.5 sm:space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Assignment Title *</label>
                <input required
                  className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-600 rounded-xl px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="e.g., Week 5 Quiz / Sheet"
                  value={newAssignment.title}
                  onChange={e => setNewAssignment({ ...newAssignment, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Department *</label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-600 rounded-xl px-2.5 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newAssignment.departmentId}
                    onChange={e => setNewAssignment(p => ({ ...p, departmentId: e.target.value, academicYear: '' }))}
                  >
                    <option value="">Select dept...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Academic Year *</label>
                  <select
                    required
                    disabled={!newAssignment.departmentId}
                    className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-600 rounded-xl px-2.5 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
                    value={newAssignment.academicYear}
                    onChange={e => setNewAssignment(p => ({ ...p, academicYear: e.target.value }))}
                  >
                    <option value="">Select year...</option>
                    {academicYears.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Semester *</label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-600 rounded-xl px-2.5 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newAssignment.semester}
                    onChange={e => setNewAssignment(p => ({ ...p, semester: e.target.value }))}
                  >
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center justify-between">
                    <span>Subject *</span>
                    {modalLoadingSubjects && <Loader2 size={11} className="animate-spin text-indigo-500" />}
                  </label>
                  <select
                    required
                    disabled={!newAssignment.departmentId || newAssignment.academicYear === '' || modalLoadingSubjects}
                    className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-600 rounded-xl px-2.5 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
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
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Start Date & Time *</label>
                <div className="flex gap-1.5">
                  <input required type="date"
                    className="flex-1 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-600 rounded-xl px-2.5 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newAssignment.startDate}
                    onChange={e => setNewAssignment({ ...newAssignment, startDate: e.target.value })}
                  />
                  <input required type="time"
                    className="w-24 sm:w-28 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-600 rounded-xl px-2 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newAssignment.startTime}
                    onChange={e => setNewAssignment({ ...newAssignment, startTime: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">End Date (Deadline) *</label>
                <div className="flex gap-1.5">
                  <input required type="date"
                    className="flex-1 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-600 rounded-xl px-2.5 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newAssignment.endDate}
                    onChange={e => setNewAssignment({ ...newAssignment, endDate: e.target.value })}
                  />
                  <input required type="time"
                    className="w-24 sm:w-28 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-600 rounded-xl px-2 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value={newAssignment.endTime}
                    onChange={e => setNewAssignment({ ...newAssignment, endTime: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 sm:py-3 bg-indigo-600 text-white rounded-xl font-bold mt-1 hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs sm:text-sm">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {loading ? 'Saving...' : 'Save and Publish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
