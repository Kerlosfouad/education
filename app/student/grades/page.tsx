'use client';

import { useEffect, useState } from 'react';
import { GraduationCap, Loader2, BookOpen, TrendingUp } from 'lucide-react';

interface GradeEntry {
  examType: string;
  score: number;
  maxScore: number;
  percentage: number;
}

interface SubjectGrades {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  semester: number;
  grades: GradeEntry[];
  total: number;
  maxTotal: number;
}

const EXAM_LABELS: Record<string, string> = {
  MIDTERM: 'Midterm',
  FINAL: 'Final',
  QUIZ: 'Quiz',
  PROJECT: 'Project',
};

function getGradeColor(pct: number) {
  if (pct >= 85) return 'text-green-600 dark:text-green-400';
  if (pct >= 70) return 'text-blue-600 dark:text-blue-400';
  if (pct >= 50) return 'text-orange-500 dark:text-orange-400';
  return 'text-red-500 dark:text-red-400';
}

function getGradeLetter(pct: number) {
  if (pct >= 90) return 'A+';
  if (pct >= 85) return 'A';
  if (pct >= 80) return 'B+';
  if (pct >= 75) return 'B';
  if (pct >= 70) return 'C+';
  if (pct >= 65) return 'C';
  if (pct >= 60) return 'D+';
  if (pct >= 50) return 'D';
  return 'F';
}

function getBarColor(pct: number) {
  if (pct >= 85) return 'bg-green-500';
  if (pct >= 70) return 'bg-blue-500';
  if (pct >= 50) return 'bg-orange-400';
  return 'bg-red-400';
}

export default function StudentGradesPage() {
  const [subjects, setSubjects] = useState<SubjectGrades[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasGrades, setHasGrades] = useState(false);

  useEffect(() => {
    fetch('/api/student/grades')
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setSubjects(j.data.subjects);
          setHasGrades(j.data.hasGrades);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  // Overall stats
  const totalScore = subjects.reduce((s, sub) => s + sub.total, 0);
  const totalMax = subjects.reduce((s, sub) => s + sub.maxTotal, 0);
  const overallPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GraduationCap className="text-indigo-600" size={28} />
        <div>
          <h2 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight">My Grades</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Your academic results by subject</p>
        </div>
      </div>

      {!hasGrades ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <GraduationCap size={56} className="mb-4 opacity-30" />
          <p className="font-semibold text-lg">No grades published yet</p>
          <p className="text-sm mt-1">Your grades will appear here once your doctor publishes them</p>
        </div>
      ) : (
        <>
          {/* Overall summary card */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-[#00c896] dark:to-[#00a87e] rounded-3xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm font-medium">Overall Score</p>
                <p className="text-5xl font-black mt-1">{overallPct}%</p>
                <p className="text-white/70 text-sm mt-1">{totalScore} / {totalMax} points</p>
              </div>
              <div className="text-right">
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-3xl font-black">{getGradeLetter(overallPct)}</span>
                </div>
                <p className="text-white/60 text-xs mt-2">{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="mt-4 bg-white/20 rounded-full h-2">
              <div className="bg-white rounded-full h-2 transition-all duration-700" style={{ width: `${overallPct}%` }} />
            </div>
          </div>

          {/* Subjects */}
          <div className="space-y-4">
            {subjects.map(sub => {
              const subPct = sub.maxTotal > 0 ? Math.round((sub.total / sub.maxTotal) * 100) : 0;
              return (
                <div key={sub.subjectId} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                  {/* Subject header */}
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center">
                        <BookOpen className="text-indigo-600" size={18} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-slate-100">{sub.subjectName}</p>
                        <p className="text-xs text-slate-400">{sub.subjectCode} · Semester {sub.semester}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-black ${getGradeColor(subPct)}`}>{getGradeLetter(subPct)}</p>
                      <p className="text-xs text-slate-400">{sub.total}/{sub.maxTotal}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="px-6 pt-4 pb-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="flex items-center gap-1"><TrendingUp size={12} /> Total Progress</span>
                      <span className={`font-bold ${getGradeColor(subPct)}`}>{subPct}%</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div className={`${getBarColor(subPct)} rounded-full h-2 transition-all duration-700`} style={{ width: `${subPct}%` }} />
                    </div>
                  </div>

                  {/* Grade breakdown */}
                  <div className="px-6 pb-5 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {sub.grades.map(g => {
                      const pct = g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : 0;
                      return (
                        <div key={g.examType} className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-3 text-center">
                          <p className="text-xs text-slate-400 font-medium mb-1">{EXAM_LABELS[g.examType] || g.examType}</p>
                          <p className={`text-xl font-black ${getGradeColor(pct)}`}>{g.score}</p>
                          <p className="text-xs text-slate-400">/ {g.maxScore}</p>
                          <div className="mt-2 bg-slate-200 dark:bg-slate-600 rounded-full h-1">
                            <div className={`${getBarColor(pct)} rounded-full h-1`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
