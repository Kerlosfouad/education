'use client';
import * as XLSX from 'xlsx';
import { useEffect, useState } from 'react';
import { Users, BookOpen, Award, ClipboardList, Search, ChevronDown, ChevronUp, Download } from 'lucide-react';

type StudentResult = {
  id: string;
  studentCode: string;
  user: { name: string; email: string };
  department: { name: string };
  academicYear: number;
  assignmentSubmissions: {
    score: number;
    status: string;
    assignment: { title: string; maxScore: number; subject: { name: string } | null };
  }[];
  quizAttempts: {
    score: number;
    maxScore: number;
    percentage: number;
    status: string;
    quiz: { title: string; subject: { name: string } | null };
  }[];
  examResults: {
    score: number;
    maxScore: number;
    percentage: number;
    grade: string;
    examType: string;
    semester: number;
    academicYear: number;
    subject: { name: string };
  }[];
  attendances: {
    id: string;
    timestamp: string;
    session: { title: string | null; openTime: string } | null;
  }[];
};

const yearLabel: Record<number, string> = {
  1: 'Level 1', 2: 'Level 2', 3: 'Level 3', 4: 'Level 4', 5: 'Level 5',
};

export default function ResultsPage() {
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/doctor/results')
      .then(r => r.json())
      .then(data => { setStudents(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const getAvg = (nums: number[]) =>
    nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;

  const filtered = students.filter(s =>
    s.user.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.studentCode.includes(search)
  );

  // Group by department + academicYear
  const groups = filtered.reduce<Record<string, StudentResult[]>>((acc, s) => {
    const key = `${s.department.name}||${s.academicYear}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const sortedGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // ── Sheet: Attendance grouped by dept/year ──
    const attWsData: any[][] = [];
    const attMerges: XLSX.Range[] = [];

    // Collect all unique session dates across all students
    const allSessions = new Map<string, string>(); // sessionId -> date label
    students.forEach(s => {
      (s.attendances || []).forEach(a => {
        const key = a.session?.openTime || a.timestamp;
        const label = new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        allSessions.set(key, label);
      });
    });
    const sessionDates = Array.from(allSessions.entries()).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());

    sortedGroups.forEach(([key, groupStudents], gi) => {
      const [dept, year] = key.split('||');
      const groupLabel = `${dept.toUpperCase()} — ${(yearLabel[Number(year)] || `Level ${year}`).toUpperCase()}`;

      if (gi > 0) {
        attWsData.push([]);
        attWsData.push([]);
      }

      // Group title row
      const titleRow = attWsData.length;
      attWsData.push([`★  ${groupLabel}`, ...Array(sessionDates.length + 2).fill('')]);
      attMerges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: sessionDates.length + 2 } });

      // Header: Name | Code | date1 | date2 | ... | Total
      attWsData.push(['Student Name', 'Code', ...sessionDates.map(([, label]) => label), 'Total Present']);

      // Student rows
      groupStudents.forEach(s => {
        const presentDates = new Set(
          (s.attendances || []).map(a => a.session?.openTime || a.timestamp)
        );
        const cells = sessionDates.map(([dateKey]) => presentDates.has(dateKey) ? '✓' : '—');
        const total = cells.filter(c => c === '✓').length;
        attWsData.push([s.user.name, s.studentCode, ...cells, total]);
      });
    });

    const attWs = XLSX.utils.aoa_to_sheet(attWsData);
    attWs['!merges'] = attMerges;
    XLSX.utils.book_append_sheet(wb, attWs, 'Attendance');

    // ── Sheet: Quizzes grouped by dept/year ──
    const quizWsData: any[][] = [];
    const quizMerges: XLSX.Range[] = [];
    sortedGroups.forEach(([key, groupStudents], gi) => {
      const [dept, year] = key.split('||');
      if (gi > 0) { quizWsData.push([]); quizWsData.push([]); }
      const titleRow = quizWsData.length;
      quizWsData.push([`★  ${dept.toUpperCase()} — ${(yearLabel[Number(year)] || `Level ${year}`).toUpperCase()}`, '', '', '', '', '']);
      quizMerges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 5 } });
      quizWsData.push(['Student Name', 'Code', 'Quiz Title', 'Score', 'Max', '%']);
      groupStudents.forEach(s => {
        if (s.quizAttempts.length === 0) {
          quizWsData.push([s.user.name, s.studentCode, 'No attempts', '—', '—', '—']);
        } else {
          s.quizAttempts.forEach(q => {
            quizWsData.push([s.user.name, s.studentCode, q.quiz.title, q.score, q.maxScore, Math.round(q.percentage) + '%']);
          });
        }
      });
    });
    const quizWs = XLSX.utils.aoa_to_sheet(quizWsData);
    quizWs['!merges'] = quizMerges;
    XLSX.utils.book_append_sheet(wb, quizWs, 'Quizzes');

    // ── Sheet: Assignments grouped by dept/year ──
    const assWsData: any[][] = [];
    const assMerges: XLSX.Range[] = [];
    sortedGroups.forEach(([key, groupStudents], gi) => {
      const [dept, year] = key.split('||');
      if (gi > 0) { assWsData.push([]); assWsData.push([]); }
      const titleRow = assWsData.length;
      assWsData.push([`★  ${dept.toUpperCase()} — ${(yearLabel[Number(year)] || `Level ${year}`).toUpperCase()}`, '', '', '', '']);
      assMerges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 4 } });
      assWsData.push(['Student Name', 'Code', 'Assignment Title', 'Score', 'Max']);
      groupStudents.forEach(s => {
        if (s.assignmentSubmissions.length === 0) {
          assWsData.push([s.user.name, s.studentCode, 'No submissions', '—', '—']);
        } else {
          s.assignmentSubmissions.forEach(sub => {
            assWsData.push([s.user.name, s.studentCode, sub.assignment.title, sub.score ?? '—', sub.assignment.maxScore]);
          });
        }
      });
    });
    const assWs = XLSX.utils.aoa_to_sheet(assWsData);
    assWs['!merges'] = assMerges;
    XLSX.utils.book_append_sheet(wb, assWs, 'Assignments');

    XLSX.writeFile(wb, `student-results-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Student Results</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">View assignments, quizzes and exam results</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name or student code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-[#1a2f4a] dark:bg-[#132540] dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <button
          onClick={exportToExcel}
          disabled={filtered.length === 0 || loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#00c896] hover:bg-[#00a87e] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 dark:bg-[#0f1f38] rounded-2xl animate-pulse" />)}
        </div>
      ) : sortedGroups.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No students found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedGroups.map(([key, groupStudents]) => {
            const [dept, year] = key.split('||');
            return (
              <div key={key}>
                {/* Group Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-[#1a2f4a]" />
                  <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-3 py-1 bg-slate-100 dark:bg-[#0f1f38] rounded-full">
                    {dept} — {yearLabel[Number(year)] || `Level ${year}`}
                  </span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-[#1a2f4a]" />
                </div>

                <div className="space-y-3">
                  {groupStudents.map((student, i) => {
                    const quizAvg = getAvg(student.quizAttempts.map(q => q.percentage ?? 0));
                    const assignAvg = getAvg(student.assignmentSubmissions.map(s => s.score ?? 0));
                    const examAvg = getAvg(student.examResults.map(e => e.percentage ?? 0));
                    const isOpen = expanded === student.id;

                    return (
                      <div key={student.id}
                        className="bg-white dark:bg-[#0f1f38] rounded-2xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm hover:shadow-md transition-all">
                        <div className="p-5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-11 h-11 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-base">
                                {student.user.name?.charAt(0) ?? '?'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 dark:text-white">{student.user.name}</p>
                                <p className="text-xs text-slate-400">#{student.studentCode}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="hidden sm:flex gap-2">
                                <StatBadge icon={<ClipboardList className="w-3.5 h-3.5" />} label="Assign" value={assignAvg} color="orange" />
                                <StatBadge icon={<BookOpen className="w-3.5 h-3.5" />} label="Quizzes" value={quizAvg} color="purple" />
                                {examAvg !== null && <StatBadge icon={<Award className="w-3.5 h-3.5" />} label="Exams" value={examAvg} color="green" />}
                              </div>
                              <button onClick={() => setExpanded(isOpen ? null : student.id)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </button>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#1a2f4a] space-y-4">
                              {student.quizAttempts.length > 0 && (
                                <Section title="Quizzes" color="purple">
                                  {student.quizAttempts.map((q, idx) => (
                                    <ResultRow key={idx} title={q.quiz.title} subject={q.quiz.subject?.name} score={q.score} max={q.maxScore} />
                                  ))}
                                </Section>
                              )}
                              {student.assignmentSubmissions.length > 0 && (
                                <Section title="Assignments" color="orange">
                                  {student.assignmentSubmissions.map((s, idx) => (
                                    <ResultRow key={idx} title={s.assignment.title} subject={s.assignment.subject?.name} score={s.score} max={s.assignment.maxScore} />
                                  ))}
                                </Section>
                              )}
                              {student.examResults.length > 0 && (
                                <Section title="Exams" color="green">
                                  {student.examResults.map((e, idx) => (
                                    <ResultRow key={idx} title={`${e.examType} — ${e.subject.name}`} subject="" score={e.score} max={e.maxScore} grade={e.grade} />
                                  ))}
                                </Section>
                              )}
                              {student.attendances && student.attendances.length > 0 && (
                                <Section title="Attendance" color="blue">
                                  {student.attendances.map((a, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm">
                                      <span className="text-slate-700 dark:text-slate-200">
                                        {a.session?.title || 'Session'} — {new Date(a.session?.openTime || a.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">✓ Present</span>
                                    </div>
                                  ))}
                                </Section>
                              )}
                              {student.quizAttempts.length === 0 && student.assignmentSubmissions.length === 0 && student.examResults.length === 0 && (!student.attendances || student.attendances.length === 0) && (
                                <p className="text-sm text-slate-400 text-center py-2">No results yet</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBadge({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | null; color: string }) {
  const colors: Record<string, string> = {
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    green:  'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  };
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold ${colors[color]}`}>
      {icon} {label}: {value !== null ? `${value}%` : 'N/A'}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const borders: Record<string, string> = {
    purple: 'border-purple-300 dark:border-purple-700',
    orange: 'border-orange-300 dark:border-orange-700',
    green:  'border-green-300 dark:border-green-700',
    blue:   'border-blue-300 dark:border-blue-700',
  };
  return (
    <div className={`border-l-4 pl-4 ${borders[color]}`}>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ResultRow({ title, subject, score, max, grade }: { title: string; subject?: string; score: number | null; max: number; grade?: string | null }) {
  const pct = score !== null && max ? Math.round((score / max) * 100) : null;
  const barColor = pct === null ? 'bg-slate-200' : pct >= 80 ? 'bg-green-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{title}</p>
        {subject && <p className="text-xs text-slate-400">{subject}</p>}
        <div className="mt-1 h-1.5 bg-slate-100 dark:bg-[#0a1628] rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct ?? 0}%` }} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="text-sm font-bold text-slate-800 dark:text-white">{score ?? '—'}/{max}</span>
        {grade && <span className="ml-2 text-xs bg-slate-100 dark:bg-[#0a1628] text-slate-500 px-2 py-0.5 rounded-full">{grade}</span>}
      </div>
    </div>
  );
}
