'use client';

import { useState, useEffect } from 'react';
import {
  Plus, FileText, ExternalLink, Clock, Users, Calendar,
  History, X, Trash2, ChevronRight, CheckCircle2, Star, Loader2
} from 'lucide-react';
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
  gradedAt: string | null;
  student: { id: string; studentCode: string; user: { name: string; email: string } };
}

interface AssignmentDetail {
  id: string;
  title: string;
  maxScore: number;
  fileUrl: string | null;
  subject: { name: string };
  submissions: Submission[];
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', formUrl: '', departmentId: '', academicYear: '' });
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);

  // Details panel
  const [selected, setSelected] = useState<AssignmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [grading, setGrading] = useState<Record<string, { score: string; feedback: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const academicYearsByDept: Record<string, { value: string; label: string }[]> = {
    PREP: [{ value: '1', label: 'First Year' }],
    default: [
      { value: '2', label: 'Second Year' },
      { value: '3', label: 'Third Year' },
      { value: '4', label: 'Fourth Year' },
      { value: '5', label: 'Fifth Year' },
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
      // pre-fill grading state
      const init: Record<string, { score: string; feedback: string }> = {};
      json.data.submissions.forEach((s: Submission) => {
        init[s.id] = { score: s.score?.toString() ?? '', feedback: s.feedback ?? '' };
      });
      setGrading(init);
    }
    setDetailLoading(false);
  };

  const saveGrade = async (submissionId: string, assignmentId: string) => {
    setSavingId(submissionId);
    const g = grading[submissionId];
    const res = await fetch(`/api/assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, score: g.score, feedback: g.feedback }),
    });
    const json = await res.json();
    if (json.success) {
      setSelected(prev => prev ? {
        ...prev,
        submissions: prev.submissions.map(s =>
          s.id === submissionId ? { ...s, score: json.data.score, feedback: json.data.feedback, status: 'GRADED', gradedAt: json.data.gradedAt } : s
        ),
      } : prev);
    }
    setSavingId(null);
  };

  const handleCreateClick = () => {
    window.open('https://forms.google.com', '_blank');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignment.departmentId || !newAssignment.academicYear) {
      alert('Please select department and academic year');
      return;
    }
    setLoading(true);
    const res = await createAssignmentAction({
      title: newAssignment.title,
      formUrl: newAssignment.formUrl,
      departmentId: newAssignment.departmentId,
      academicYear: parseInt(newAssignment.academicYear),
    });
    if (res.success) {
      setIsModalOpen(false);
      setNewAssignment({ title: '', formUrl: '', departmentId: '', academicYear: '' });
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
          <p className="text-slate-500 dark:text-slate-400 mt-1">Create assignments and grade student submissions.</p>
        </div>
        <button onClick={handleCreateClick}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none transition-all w-fit">
          <Plus size={20} /> Create New Assignment
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignment List */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <History className="text-indigo-500" size={20} />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">All Assignments</h3>
          </div>
          {assignments.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>No assignments yet</p>
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
                  <p className="text-xs text-slate-400 mt-0.5">{selected.subject.name} &bull; Max score: {selected.maxScore}</p>
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
                  <p className="text-sm">No submissions yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {selected.submissions.map(sub => {
                    const g = grading[sub.id] ?? { score: '', feedback: '' };
                    const isGraded = sub.status === 'GRADED';
                    return (
                      <div key={sub.id} className="bg-slate-50 dark:bg-slate-700/40 rounded-2xl p-4 space-y-3">
                        {/* Student info */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 font-bold text-sm">
                              {sub.student.user.name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{sub.student.user.name}</p>
                              <p className="text-xs text-slate-400">{sub.student.studentCode}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isGraded && (
                              <span className="text-xs font-black bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle2 size={11} /> {sub.score}/{selected.maxScore}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              {new Date(sub.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        {/* Grading inputs */}
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={0}
                            max={selected.maxScore}
                            placeholder={`Score / ${selected.maxScore}`}
                            value={g.score}
                            onChange={e => setGrading(prev => ({ ...prev, [sub.id]: { ...prev[sub.id], score: e.target.value } }))}
                            className="w-28 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                          <input
                            type="text"
                            placeholder="Feedback (optional)"
                            value={g.feedback}
                            onChange={e => setGrading(prev => ({ ...prev, [sub.id]: { ...prev[sub.id], feedback: e.target.value } }))}
                            className="flex-1 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                          <button
                            onClick={() => saveGrade(sub.id, selected.id)}
                            disabled={!g.score || savingId === sub.id}
                            className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-40"
                          >
                            {savingId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Google Form URL</label>
                <input required
                  className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                  placeholder="Paste URL here..."
                  value={newAssignment.formUrl}
                  onChange={e => setNewAssignment({ ...newAssignment, formUrl: e.target.value })}
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
