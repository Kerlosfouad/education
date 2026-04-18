'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen, Clock, Users, Trash2, ToggleLeft, ToggleRight, X, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

type Quiz = {
  id: string;
  title: string;
  description: string;
  timeLimit: number;
  passingScore: number;
  isPublished: boolean;
  startTime: string | null;
  endTime: string | null;
  departmentId: string | null;
  academicYear: number | null;
  subject: { name: string } | null;
  _count: { questions: number; attempts: number };
};

type Attempt = {
  id: string;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  student: { studentCode: string; user: { name: string } };
};

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/quizzes')
      .then(r => r.json())
      .then(data => { setQuizzes(Array.isArray(data.data) ? data.data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const openQuiz = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setAttempts([]);
    setAttemptsLoading(true);
    const res = await fetch(`/api/doctor/quiz-attempts?quizId=${quiz.id}`);
    const json = await res.json();
    if (json.success) setAttempts(json.data);
    setAttemptsLoading(false);
  };

  const togglePublish = async (e: React.MouseEvent, id: string, current: boolean) => {
    e.stopPropagation();
    await fetch(`/api/quizzes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !current }),
    });
    setQuizzes(prev => prev.map(q => q.id === id ? { ...q, isPublished: !current } : q));
  };

  const deleteQuiz = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this quiz?')) return;
    await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
    setQuizzes(prev => prev.filter(q => q.id !== id));
    if (selectedQuiz?.id === id) setSelectedQuiz(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-800 dark:text-slate-100">{t('quizzes')}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('createManageQuizzes')}</p>
        </div>
        <Link href="/doctor/quizzes/create"
          className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-medium rounded-xl transition-colors whitespace-nowrap">
          <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" /> {t('newQuiz')}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quiz list */}
        <div className="space-y-4">
          {loading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)
          ) : quizzes.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('noQuizzesCreateFirst')}</p>
            </div>
          ) : quizzes.map((quiz, i) => (
            <motion.div key={quiz.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => openQuiz(quiz)}
              className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm p-5 cursor-pointer transition-all hover:shadow-md ${selectedQuiz?.id === quiz.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-100 dark:border-slate-700'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800 dark:text-slate-100">{quiz.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${quiz.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {quiz.isPublished ? t('published') : t('draft')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{quiz.subject?.name ?? `Level ${quiz.academicYear}`}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><BookOpen className="w-4 h-4 text-indigo-400" />{quiz._count.questions} {t('questions')}</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-purple-400" />{quiz.timeLimit} {t('minutes')}</span>
                    <span className="flex items-center gap-1"><Users className="w-4 h-4 text-green-400" />{quiz._count.attempts} {t('attempts')}</span>
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{t('pass')}: {quiz.passingScore}%</span>
                  </div>
                  {quiz.endTime && <p className="mt-2 text-xs text-gray-400">· {t('end')}: {new Date(quiz.endTime).toLocaleString()}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => togglePublish(e, quiz.id, quiz.isPublished)}
                    className={`p-2 rounded-xl transition-colors ${quiz.isPublished ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}>
                    {quiz.isPublished ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={e => deleteQuiz(e, quiz.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Attempts panel */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 h-fit">
          {!selectedQuiz ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <BookOpen size={40} className="opacity-20 mb-3" />
              <p className="text-sm">Click a quiz to see student attempts</p>
            </div>
          ) : attemptsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{selectedQuiz.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{attempts.length} attempts</p>
                </div>
                <button onClick={() => setSelectedQuiz(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <X size={16} className="text-slate-400" />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{attempts.length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Total</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-green-700 dark:text-green-400">
                    {attempts.filter(a => (a.percentage ?? 0) >= selectedQuiz.passingScore).length}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Passed</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-red-600 dark:text-red-400">
                    {attempts.filter(a => a.status === 'COMPLETED' && (a.percentage ?? 0) < selectedQuiz.passingScore).length}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Failed</p>
                </div>
              </div>

              {attempts.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Users size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No attempts yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {attempts.map(a => {
                    const passed = (a.percentage ?? 0) >= selectedQuiz.passingScore;
                    const completed = a.status === 'COMPLETED';
                    return (
                      <div key={a.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/40 rounded-2xl p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 font-bold text-xs">
                            {a.student.user.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{a.student.user.name}</p>
                            <p className="text-xs text-slate-400">{a.student.studentCode}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {completed ? (
                            <>
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{a.score}/{a.maxScore}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {passed ? <CheckCircle size={11} /> : <XCircle size={11} />}
                                {a.percentage}%
                              </span>
                            </>
                          ) : (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">In Progress</span>
                          )}
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
    </div>
  );
}
