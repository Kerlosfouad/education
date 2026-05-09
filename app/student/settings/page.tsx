'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, User, Hash, Building2, GraduationCap, Plus, X, BookOpen } from 'lucide-react';

interface Department { id: string; name: string; code: string; }
interface CoreSubject { id: string; subjectId: string; subjectName: string; subjectCode: string; semester: number; }
interface Enrollment { id: string; subjectId: string; subjectName: string; subjectCode: string; semester: number; }
interface EnrollmentRequest { id: string; subjectId: string; subjectName: string; subjectCode: string; semester: number; status: string; }
interface Subject { id: string; name: string; code: string; semester: number; }

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState('1');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableLevels, setAvailableLevels] = useState<number[]>([1, 2, 3, 4]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Enrollment state
  const [coreSubjects, setCoreSubjects] = useState<CoreSubject[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentRequests, setEnrollmentRequests] = useState<EnrollmentRequest[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [unenrolling, setUnenrolling] = useState<string | null>(null);

  const fetchEnrollments = async () => {
    const res = await fetch('/api/student/enrollments');
    const json = await res.json();
    if (json.success) {
      setCoreSubjects(json.data.coreSubjects ?? []);
      setEnrollments(json.data.enrollments ?? []);
      setEnrollmentRequests(json.data.requests ?? []);
    }
  };

  const fetchAvailableSubjects = async (deptId: string, year: string) => {
    if (!deptId) return;
    // Fetch all subjects in student's department (any level) + PREP subjects
    const [deptRes, prepRes] = await Promise.all([
      fetch(`/api/subjects?departmentId=${deptId}`),
      fetch(`/api/subjects/departments`),
    ]);
    const [deptJson, deptsJson] = await Promise.all([deptRes.json(), prepRes.json()]);
    let subjects: Subject[] = deptJson.success ? deptJson.data : [];

    // Add PREP subjects if student is not already in PREP
    if (deptsJson.success) {
      const prepDept = deptsJson.data.find((d: any) => d.code === 'PREP');
      if (prepDept && prepDept.id !== deptId) {
        const prepRes2 = await fetch(`/api/subjects?departmentId=${prepDept.id}`);
        const prepJson = await prepRes2.json();
        if (prepJson.success) {
          const prepSubjects = prepJson.data.filter((s: Subject) => !subjects.find(x => x.id === s.id));
          subjects = [...subjects, ...prepSubjects];
        }
      }
    }
    setAvailableSubjects(subjects);
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/student/profile').then(r => r.json()),
      fetch('/api/subjects/departments').then(r => r.json()),
      fetch('/api/student/enrollments').then(r => r.json()),
    ]).then(([profileJson, deptsJson, enrollJson]) => {
      if (profileJson.success) {
        setName(profileJson.data.user.name || '');
        setStudentCode(profileJson.data.studentCode || '');
        setDepartmentId(profileJson.data.departmentId || '');
        setAcademicYear(String(profileJson.data.academicYear ?? ''));
        setSemester(String(profileJson.data.semester ?? '1'));
        if (profileJson.data.departmentId && profileJson.data.academicYear) {
          fetchAvailableSubjects(profileJson.data.departmentId, String(profileJson.data.academicYear));
        }
      }
      if (deptsJson.success) setDepartments(deptsJson.data);
      if (enrollJson.success) {
        setCoreSubjects(enrollJson.data.coreSubjects ?? []);
        setEnrollments(enrollJson.data.enrollments ?? []);
        setEnrollmentRequests(enrollJson.data.requests ?? []);
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!departmentId) { setAvailableLevels([1, 2, 3, 4]); return; }
    const dept = departments.find(d => d.id === departmentId);
    if (dept?.code === 'PREP') {
      setAvailableLevels([0]);
      setAcademicYear('0');
    } else {
      setAvailableLevels([1, 2, 3, 4]);
      setAcademicYear(prev => prev === '0' ? '' : prev);
    }
  }, [departmentId, departments]);

  useEffect(() => {
    if (departmentId && academicYear) fetchAvailableSubjects(departmentId, academicYear);
  }, [departmentId, academicYear]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(false); setSaving(true);
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          studentCode: studentCode.trim(),
          departmentId: departmentId || undefined,
          academicYear: academicYear !== '' ? Number(academicYear) : undefined,
          semester: Number(semester),
        }),
      });
      const json = await res.json();
      if (json.success) setSuccess(true);
      else setError(json.error || 'Something went wrong');
    } catch { setError('Network error'); }
    setSaving(false);
  };

  const handleEnroll = async (subjectId: string) => {
    setEnrolling(subjectId);
    const res = await fetch('/api/student/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId }),
    });
    const json = await res.json();
    if (json.success) {
      await fetchEnrollments();
      setShowSubjectPicker(false);
    }
    setEnrolling(null);
  };

  const handleUnenroll = async (subjectId: string) => {
    setUnenrolling(subjectId);
    await fetch('/api/student/enrollments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId }),
    });
    await fetchEnrollments();
    setUnenrolling(null);
  };

  const coreIds = new Set(coreSubjects.map(s => s.subjectId));
  const enrolledIds = new Set(enrollments.map(e => e.subjectId));
  const pendingIds = new Set(enrollmentRequests.filter(r => r.status === 'PENDING').map(r => r.subjectId));
  // Hide core subjects + already enrolled/pending from the picker
  const unenrolledSubjects = availableSubjects.filter(s => !coreIds.has(s.id) && !enrolledIds.has(s.id) && !pendingIds.has(s.id));

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-blue-600" size={40} />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">Settings</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Update your profile information.</p>
      </div>

      {/* Profile Form */}
      <div className="bg-white dark:bg-[#0f1f38] rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm p-6">
        <form onSubmit={handleSave} className="space-y-5">
          {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl px-4 py-3 text-sm">{error}</div>}
          {success && <div className="bg-green-50 dark:bg-green-900/20 text-green-600 rounded-2xl px-4 py-3 text-sm font-medium">Saved successfully!</div>}

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your full name"
                className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-[#0a1628]/60 border border-slate-200 dark:border-[#1a2f4a] rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Student Code</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" value={studentCode}
                onChange={e => setStudentCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                required placeholder="e.g. 24179" maxLength={5} pattern="\d{5}" inputMode="numeric"
                className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-[#0a1628]/60 border border-slate-200 dark:border-[#1a2f4a] rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">5 digits only</p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Department</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-[#0a1628]/60 border border-slate-200 dark:border-[#1a2f4a] rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none">
                <option value="">Select department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Level</label>
            <div className="relative">
              <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-[#0a1628]/60 border border-slate-200 dark:border-[#1a2f4a] rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none">
                <option value="">Select level</option>
                {availableLevels.map(l => <option key={l} value={String(l)}>Level {l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Semester</label>
            <div className="relative">
              <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select value={semester} onChange={e => setSemester(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-[#0a1628]/60 border border-slate-200 dark:border-[#1a2f4a] rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none">
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Enrolled Subjects */}
      <div className="bg-white dark:bg-[#0f1f38] rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-500" />
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Enrolled Subjects</h3>
            {(coreSubjects.length + enrollments.length) > 0 && (
              <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 px-2 py-0.5 rounded-full">{coreSubjects.length + enrollments.length}</span>
            )}
          </div>
          <button onClick={() => setShowSubjectPicker(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors">
            <Plus size={13} /> Add Subject
          </button>
        </div>

        {/* Subject Picker */}
        {showSubjectPicker && (
          <div className="mb-4 p-3 bg-slate-50 dark:bg-[#0a1628]/60 rounded-2xl border border-slate-200 dark:border-[#1a2f4a]">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Available Subjects</p>
            {unenrolledSubjects.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">No more subjects available</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {unenrolledSubjects.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-[#0f1f38] rounded-xl border border-slate-100 dark:border-[#1a2f4a]">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{s.name}</p>
                      <p className="text-[10px] text-slate-400">{s.code} · Semester {s.semester}</p>
                    </div>
                    <button onClick={() => handleEnroll(s.id)} disabled={enrolling === s.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                      {enrolling === s.id ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                      Enroll
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Enrolled list */}
        {coreSubjects.length === 0 && enrollments.length === 0 && enrollmentRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No subjects enrolled yet</p>
            <p className="text-xs mt-1">Click "Add Subject" to request enrollment</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Core subjects — read only */}
            {coreSubjects.map(s => (
              <div key={s.subjectId} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#0a1628]/60 rounded-xl border border-slate-100 dark:border-[#1a2f4a]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                    <BookOpen size={14} className="text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{s.subjectName}</p>
                    <p className="text-[10px] text-slate-400">{s.subjectCode} · Semester {s.semester}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 px-2 py-0.5 rounded-full">Core</span>
              </div>
            ))}
            {/* Extra enrolled subjects */}
            {enrollments.map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#0a1628]/60 rounded-xl border border-slate-100 dark:border-[#1a2f4a]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                    <BookOpen size={14} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{e.subjectName}</p>
                    <p className="text-[10px] text-slate-400">{e.subjectCode} · Semester {e.semester}</p>
                  </div>
                </div>
                <button onClick={() => handleUnenroll(e.subjectId)} disabled={unenrolling === e.subjectId}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50">
                  {unenrolling === e.subjectId ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                </button>
              </div>
            ))}
            {/* Pending requests */}
            {enrollmentRequests.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <BookOpen size={14} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{r.subjectName}</p>
                    <p className="text-[10px] text-slate-400">{r.subjectCode} · Semester {r.semester}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 px-2 py-0.5 rounded-full">
                    {r.status === 'PENDING' ? 'Pending' : r.status === 'REJECTED' ? 'Rejected' : r.status}
                  </span>
                  <button onClick={() => handleUnenroll(r.subjectId)} disabled={unenrolling === r.subjectId}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50">
                    {unenrolling === r.subjectId ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
