'use client';

import { useState, useEffect } from 'react';
import {
  Plus, FileText, ExternalLink, Users,
  History, X, Trash2, ChevronRight, Loader2, Search, Filter, Lock, Unlock
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  getAssignmentsAction,
  createAssignmentAction,
  deleteAssignmentAction,
} from '../../actions/assignmentActions';

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
  const [newAssignment, setNewAssignment] = useState({ title: '', departmentId: '', academicYear: '', semester: '1', startDate: '', startTime: '00:00', endDate: '', endTime: '23:59' });
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterAvailableLevels, setFilterAvailableLevels] = useState<{ value: string; label: string }[]>([]);

  // Details panel
  const [selected, setSelected] = useState<AssignmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Grading state
  const [maxScoreInput, setMaxScoreInput] = useState<string>('');
  const [updatingMaxScore, setUpdatingMaxScore] = useState(false);
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

  const filteredAssignments = assignments.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    const matchDept = !filterDept || a.department?.name === filterDept;
    const matchLevel = !filterLevel || String(a.academicYear) === filterLevel;
    const matchSemester = !filterSemester || String(a.semester) === filterSemester;
    return matchSearch && matchDept && matchLevel && matchSemester;
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
    }
    setDetailLoading(false);
  };

  const handleCreateClick = () => {
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignment.departmentId || newAssignment.academicYear === '' || newAssignment.academicYear === undefined) {
      alert('Please select department and academic year');
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
      startDate,
      deadline,
    });
    if (res.success) {
      setIsModalOpen(false);
      setNewAssignment({ title: '', departmentId: '', academicYear: '', semester: '1', startDate: '', startTime: '00:00', endDate: '', endTime: '23:59' });
      refreshData();
    } else {
      alert('Error: ' + res.error);
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
      alert('Please enter a max score');
      return;
    }
    const newMaxScore = Number(maxScoreInput);
    if (isNaN(newMaxScore) || newMaxScore <= 0) {
      alert('Max score must be a positive number');
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
        // Refresh details
        if (selected) await openDetails(selected.id);
        alert('Max score updated successfully!');
      } else {
        alert('Error: ' + (json.error || 'Failed to update'));
      }
    } catch (error) {
      alert('Error updating max score');
    }
    setUpdatingMaxScore(false);
  };

  const handleGradeSubmission = async (submissionId: string) => {
    if (!selected) return;
    
    setGradingLoading(submissionId);
    try {
      const res = await fetch(`/api/assignments/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, score: selected.maxScore }),
      });
      const json = await res.json();
      if (json.success) {
        // Refresh details
        await openDetails(selected.id);
      } else {
        alert('Error: ' + (json.error || 'Failed to grade'));
      }
    } catch (error) {
      alert('Error grading submission');
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
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="text" placeholder="Search..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setFilterLevel(''); }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="">All Depts</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="">All Levels</option>
              {filterAvailableLevels.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="">All Semesters</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
            {(filterDept || filterLevel || filterSemester || search) && (
              <button onClick={() => { setFilterDept(''); setFilterLevel(''); setFilterSemester(''); setSearch(''); }}
                className="flex items-center gap-1 px-3 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 transition-colors">
                <X size={13} /> Reset
              </button>
            )}
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>{assignments.length === 0 ? t('noAssignmentsYet') : 'No assignments match filters'}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredAssignments.map(a => {
                const isNew = Date.now() - new Date(a.createdAt).getTime() < 24 * 60 * 60 * 1000;
                const isSelected = selected?.id === a.id;
                return (
                  <div key={a.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700'
                        : 'bg-slate-50 dark:bg-slate-700/40 border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700'
                    }`}
                    onClick={() => openDetails(a.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isNew ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-slate-600'}`}>
                        <FileText size={18} className={isNew ? 'text-green-600' : 'text-slate-400'} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{a.title}</p>
                        <p className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} &bull; {a._count?.submissions ?? 0} submissions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isNew && <span className="text-[10px] font-black bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-1 rounded-full">New</span>}
                      <button onClick={e => { e.stopPropagation(); handleToggleActive(a.id, e); }}
                        title={a.isActive ? 'Close assignment' : 'Open assignment'}
                        className={`p-1.5 rounded-lg transition-colors ${a.isActive ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        {a.isActive ? <Unlock size={15} /> : <Lock size={15} />}
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 size={15} />
                      </button>
                      <ChevronRight size={16} className={`text-slate-300 transition-transform ${isSelected ? 'rotate-90 text-indigo-500' : ''}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Details Panel */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
          {detailLoading ? (
            <div className="flex items-center justify-center h-full min-h-[200px]">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
          ) : !selected ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-slate-400">
              <ChevronRight size={40} className="opacity-20 mb-3" />
              <p className="text-sm">Select an assignment to view submissions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Assignment header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{selected.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selected.department
                      ? `${selected.department.name}${selected.academicYear !== null && selected.academicYear !== undefined ? ` • Level ${selected.academicYear}` : ''}`
                      : 'All Students'}
                    {' • Max score: '}{selected.maxScore}
                  </p>
                </div>
                {selected.fileUrl && (
                  <a href={selected.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-bold px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
                    <ExternalLink size={12} /> Form
                  </a>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{selected.submissions.length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Submitted</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-green-700 dark:text-green-400">{selected.submissions.filter(s => s.status === 'GRADED').length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Graded</p>
                </div>
              </div>

              {/* Submissions list */}
              {selected.submissions.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Users size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('noSubmissionsYet')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Max Score Input */}
                  <div className="flex items-end gap-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-3 border border-indigo-200 dark:border-indigo-800">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1.5 block">
                        Max Score (current: {selected.maxScore})
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder={String(selected.maxScore)}
                        value={maxScoreInput}
                        onChange={e => setMaxScoreInput(e.target.value)}
                        className="w-full bg-white dark:bg-slate-700 border border-indigo-300 dark:border-indigo-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      onClick={handleUpdateMaxScore}
                      disabled={updatingMaxScore || maxScoreInput === String(selected.maxScore)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0">
                      {updatingMaxScore ? <Loader2 size={14} className="animate-spin" /> : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Set
                    </button>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto pr-1 space-y-4">
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
                      <p className="text-xs font-black text-slate-400 uppercase mb-2 px-1">{groupKey}</p>
                      <div className="space-y-2">
                        {subs.map(sub => (
                          <div key={sub.id} className="bg-slate-50 dark:bg-slate-700/40 rounded-2xl p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                  {sub.student.user.name?.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{sub.student.user.name}</p>
                                  <p className="text-xs text-slate-400">{sub.student.studentCode} · {new Date(sub.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                </div>
                              </div>
                              {sub.fileUrl ? (
                                <div className="flex gap-1.5">
                                  <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-bold px-2.5 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors">
                                    <ExternalLink size={11} /> View
                                  </a>
                                  <span className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold px-2.5 py-1.5 rounded-xl">
                                    <FileText size={11} /> {sub.totalSubmissions}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-600 px-2 py-1 rounded-full">No file</span>
                              )}
                            </div>
                            
                            {/* Grading Section */}
                            {sub.status === 'GRADED' ? (
                              <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-xl p-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-green-700 dark:text-green-400">Graded</p>
                                    <p className="text-[10px] text-slate-400">
                                      {sub.gradedAt && new Date(sub.gradedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-black text-green-700 dark:text-green-400">{sub.score}</p>
                                  <p className="text-[10px] text-slate-400">/ {selected.maxScore}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleGradeSubmission(sub.id)}
                                  disabled={gradingLoading === sub.id}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                  {gradingLoading === sub.id ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  Approve ({selected.maxScore})
                                </button>
                              </div>
                            )}
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">New Assignment</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Assignment Title</label>
                <input required
                  className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                  placeholder="e.g., Week 5 Quiz"
                  value={newAssignment.title}
                  onChange={e => setNewAssignment({ ...newAssignment, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Department *</label>
                <select
                  required
                  className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                  value={newAssignment.departmentId}
                  onChange={e => setNewAssignment(p => ({ ...p, departmentId: e.target.value, academicYear: '' }))}
                >
                  <option value="">Select department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Academic Year *</label>
                <select
                  required
                  disabled={!newAssignment.departmentId}
                  className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none disabled:opacity-50"
                  value={newAssignment.academicYear}
                  onChange={e => setNewAssignment(p => ({ ...p, academicYear: e.target.value }))}
                >
                  <option value="">Select year...</option>
                  {academicYears.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Semester *</label>
                <select
                  required
                  className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                  value={newAssignment.semester}
                  onChange={e => setNewAssignment(p => ({ ...p, semester: e.target.value }))}
                >
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Start Date & Time *</label>
                <div className="flex gap-2">
                  <input required type="date"
                    className="flex-1 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                    value={newAssignment.startDate}
                    onChange={e => setNewAssignment({ ...newAssignment, startDate: e.target.value })}
                  />
                  <input required type="time"
                    className="w-32 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                    value={newAssignment.startTime}
                    onChange={e => setNewAssignment({ ...newAssignment, startTime: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">End Date & Time (Deadline) *</label>
                <div className="flex gap-2">
                  <input required type="date"
                    className="flex-1 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                    value={newAssignment.endDate}
                    onChange={e => setNewAssignment({ ...newAssignment, endDate: e.target.value })}
                  />
                  <input required type="time"
                    className="w-32 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                    value={newAssignment.endTime}
                    onChange={e => setNewAssignment({ ...newAssignment, endTime: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold mt-2 hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                {loading ? 'Saving...' : 'Save and Publish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
