'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Clock, Users, Trash2, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
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

export default function QuizzesPage() {
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

  const togglePublish = async (id: string, current: boolean) => {
    await fetch(`/api/quizzes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !current }),
    });
    setQuizzes(prev => prev.map(q => q.id === id ? { ...q, isPublished: !current } : q));
  };

  const deleteQuiz = async (id: string) => {
    if (!confirm('Delete this quiz?')) return;
    await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
    setQuizzes(prev => prev.filter(q => q.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{t('quizzes')}</h1>
          <p className="text-gray-500 mt-1">{t('createManageQuizzes')}</p>
        </div>
        <Link
          href="/doctor/quizzes/create"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('newQuiz')}
        </Link>
      </div>

      {/* Quiz Cards */}
      {loading ? (
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t('noQuizzesCreateFirst')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {quizzes.map((quiz, i) => (
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      quiz.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {quiz.isPublished ? t('published') : t('draft')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    {quiz.subject?.name ?? `Year ${quiz.academicYear}`}
                  </p>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-indigo-400" />
                      {quiz._count.questions} {t('questions')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-purple-400" />
                      {quiz.timeLimit} {t('minutes')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-green-400" />
                      {quiz._count.attempts} {t('attempts')}
                    </span>
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                      {t('pass')}: {quiz.passingScore}%
                    </span>
                  </div>

                  {(quiz.startTime || quiz.endTime) && (
                    <div className="mt-2 text-xs text-gray-400">
                      {quiz.startTime && <span>{t('start')}: {new Date(quiz.startTime).toLocaleString()} </span>}
                      {quiz.endTime && <span>· {t('end')}: {new Date(quiz.endTime).toLocaleString()}</span>}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePublish(quiz.id, quiz.isPublished)}
                    className={`p-2 rounded-xl transition-colors ${
                      quiz.isPublished
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-50'
                    }`}
                    title={quiz.isPublished ? t('unpublish') : t('publish')}
                  >
                    {quiz.isPublished ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => deleteQuiz(quiz.id)}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}