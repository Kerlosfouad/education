'use client';

import { useState, useEffect } from 'react';
import {
  Plus, FileText, ExternalLink, Users,
  History, X, Trash2, ChevronRight, Loader2, Download, Search, Filter
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
  const [newAssignment, setNewAssignment] = useState({ title: '', departmentId: '', academicYear: '', durationDays: '7' });
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterAvailableLevels, setFilterAvailableLevels] = useState<{ value: string; label: string }[]>([]);

  // Details panel
  const [selected, setSelected] = useState<AssignmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
    return matchSearch && matchDept && matchLevel;
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
    if (json.success) setSelected(json.data);
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
    const res = await createAssignmentAction({
      title: newAssignment.title,
      departmentId: newAssignment.departmentId,
      academicYear: parseInt(newAssignment.academicYear),
      durationDays: parseInt(newAssignment.durationDays),
    });
    if (res.success) {
      setIsModalOpen(false);
setNewAssignment({ title: '', departmentId: '', academicYear: '', durationDays: '7' });
      refreshData();
    } else {
      alert('Error: ' + res.error);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assignment?')) return;
    const res = await deleteAssignmentAction(id);
    if (res.success) {
      refreshData();
      if (selected?.id === id) setSelected(null);
    }
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
          {assignments.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t('noAssignmentsYet')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => {
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
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{selected.submissions.length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Submitted</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-green-700 dark:text-green-400">{selected.submissions.filter(s => s.status === 'GRADED').length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Graded</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-orange-600 dark:text-orange-400">{selected.submissions.filter(s => s.status !== 'GRADED').length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Pending</p>
                </div>
              </div>

              {/* Submissions list */}
              {selected.submissions.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Users size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('noSubmissionsYet')}</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                  {/* Filter Bar */}
                  <div className="flex flex-wrap gap-2">
                    <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setFilterLevel(''); }}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                      <option value="">All Departments</option>
                      {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                    <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                      <option value="">All Levels</option>
                      {filterAvailableLevels.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                    {(filterDept || filterLevel) && (
                      <button onClick={() => { setFilterDept(''); setFilterLevel(''); }}
                        className="flex items-center gap-1 px-3 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 transition-colors">
                        <X size={13} /> Reset
                      </button>
                    )}
                  </div>
                  {/* Group by department + year */}
                  {Object.entries(
                    selected.submissions
                      .filter(sub => {
                        const matchDept = !filterDept || sub.student.department?.name === filterDept;
                        const matchLevel = !filterLevel || String(sub.student.academicYear) === filterLevel;
                        return matchDept && matchLevel;
                      })
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
                          <div key={sub.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/40 rounded-2xl p-3">
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
                                <a href={sub.fileUrl} download
                                  className="flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-600 font-bold px-2.5 py-1.5 rounded-xl hover:bg-green-100 transition-colors">
                                  <Download size={11} /> Save
                                </a>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-600 px-2 py-1 rounded-full">No file</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Duration (Days) *</label>
                <input required type="number" min="1" max="30"
                  className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                  placeholder="e.g., 7"
                  value={newAssignment.durationDays}
                  onChange={e => setNewAssignment({ ...newAssignment, durationDays: e.target.value })}
                />
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
