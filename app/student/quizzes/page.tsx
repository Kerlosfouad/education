'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
  _count: { questions: number };
  studentAttempts: {
    id: string;
    score: number;
    maxScore: number;
    percentage: number;
    status: string;
    completedAt: string;
  }[];
};

export default function StudentQuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/quizzes')
      .then(r => r.json())
      .then(data => {
        setQuizzes(Array.isArray(data.data) ? data.data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getQuizStatus = (quiz: Quiz) => {
    const now = new Date();
    if (quiz.endTime && new Date(quiz.endTime) < now) return 'expired';
    if (quiz.startTime && new Date(quiz.startTime) > now) return 'upcoming';
    const attempts = quiz.studentAttempts ?? [];
    const completed = attempts.find(a => a.status === 'COMPLETED');
    if (completed) return 'completed';
    return 'available';
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">{t('myQuizzes')}</h1>
        <p className="text-gray-500 mt-1">{t('takeQuizzesBeforeDeadline')}</p>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t('noQuizzesYet')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {quizzes.map((quiz, i) => {
            const status = getQuizStatus(quiz);
            const attempt = (quiz.studentAttempts ?? []).find(a => a.status === 'COMPLETED');

            return (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-800">{quiz.title}</h3>
                      <StatusBadge status={status} />
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      {quiz.subject?.name ?? `Year ${quiz.academicYear}`}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4 text-blue-400" />
                        {quiz._count.questions} {t('questions')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-purple-400" />
                        {quiz.timeLimit} {t('minutes')}
                      </span>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                        {t('pass')}: {quiz.passingScore}%
                      </span>
                    </div>

                    {quiz.endTime && (
                      <p className="text-xs text-red-400 mt-2">
                        {t('deadline')}: {new Date(quiz.endTime).toLocaleString()}
                      </p>
                    )}

                    {/* Result if completed */}
                    {attempt && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-2">
                          {attempt.percentage >= quiz.passingScore
                            ? <CheckCircle className="w-4 h-4 text-green-500" />
                            : <XCircle className="w-4 h-4 text-red-500" />
                          }
                          <span className="text-sm font-medium text-gray-700">
                            {t('score')}: {attempt.score}/{attempt.maxScore} ({attempt.percentage}%)
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            attempt.percentage >= quiz.passingScore
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {attempt.percentage >= quiz.passingScore ? t('passed') : t('failed')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="shrink-0">
                    {status === 'available' && (
                      <Link
                        href={`/student/quizzes/${quiz.id}`}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
                      >
                        {t('startQuiz')}
                      </Link>
                    )}
                    {status === 'completed' && (
                      <Link
                        href={`/student/quizzes/${quiz.id}`}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-xl transition-colors"
                      >
                        {t('viewResult')}
                      </Link>
                    )}
                    {status === 'expired' && (
                      <span className="px-4 py-2 bg-red-50 text-red-400 text-sm font-medium rounded-xl">
                        {t('expired')}
                      </span>
                    )}
                    {status === 'upcoming' && (
                      <span className="px-4 py-2 bg-yellow-50 text-yellow-600 text-sm font-medium rounded-xl">
                        {t('upcoming')}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const styles: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    expired: 'bg-red-100 text-red-700',
    upcoming: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status === 'available' ? t('open')
        : status === 'completed' ? t('submitted')
        : status === 'expired' ? t('expired')
        : status === 'upcoming' ? t('upcoming')
        : status}
    </span>
  );
}