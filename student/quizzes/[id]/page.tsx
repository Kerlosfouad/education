'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Question = {
  id: string;
  type: string;
  question: string;
  options: string[];
  points: number;
  order: number;
};

type Quiz = {
  id: string;
  title: string;
  description: string;
  timeLimit: number;
  passingScore: number;
  academicYear: number | null;
  subject: { name: string } | null;
  questions: Question[];
};

type Result = {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  passingScore: number;
  gradedAnswers: {
    questionId: string;
    question: string;
    studentAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    points: number;
    maxPoints: number;
    explanation?: string;
  }[];
};

export default function QuizPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    fetch(`/api/quizzes/${id}`)
      .then(r => r.json())
      .then(data => {
        setQuiz(data.data);
        setTimeLeft(data.data.timeLimit * 60);

        // Check if already completed - show result directly
        const attempts = data.data.studentAttempts ?? [];
        const completed = attempts.find((a: any) => a.status === 'COMPLETED');
        if (completed) {
          setResult({
            score: completed.score ?? 0,
            maxScore: completed.maxScore ?? 0,
            percentage: completed.percentage ?? 0,
            passed: (completed.percentage ?? 0) >= data.data.passingScore,
            passingScore: data.data.passingScore,
            gradedAnswers: Array.isArray(completed.answers) ? completed.answers : [],
          });
        }

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSubmit = useCallback(async (auto = false) => {
    if (!quiz || submitting) return;
    setSubmitting(true);
    try {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      const res = await fetch(`/api/quizzes/${id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, timeSpent }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        alert(data.error || t('failedToSubmitQuiz'));
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert(t('networkErrorPleaseTryAgain'));
    } finally {
      setSubmitting(false);
    }
  }, [quiz, submitting, id, answers, startTime]);

  // Timer
  useEffect(() => {
    if (!started || result) return;
    if (timeLeft <= 0) {
      handleSubmit(true);
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [started, timeLeft, result, handleSubmit]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const timerColor = timeLeft <= 60 ? 'text-red-500' : timeLeft <= 180 ? 'text-yellow-500' : 'text-blue-600';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!quiz) return (
    <div className="p-6 text-center text-gray-400">{t('quizNotFound')}</div>
  );

  // ===== Result =====
  if (result) return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-3xl p-8 text-center ${result.passed ? 'bg-green-50' : 'bg-red-50'}`}
      >
        {result.passed
          ? <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          : <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        }
        <h2 className="text-2xl font-bold text-gray-800 mb-1">
          {result.passed ? `🎉 ${t('congratulations')}` : t('keepTrying')}
        </h2>
        <p className="text-gray-500 mb-4">{quiz.title}</p>
        <div className="text-5xl font-black mb-2" style={{ color: result.passed ? '#22c55e' : '#ef4444' }}>
          {result.percentage}%
        </div>
        <p className="text-gray-500 text-sm">
          {result.score} / {result.maxScore} {t('points')} · {t('pass')}: {result.passingScore}%
        </p>
      </motion.div>

      {/* Answer Details */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-700">{t('answerReview')}</h3>
        {result.gradedAnswers.map((a, i) => (
          <motion.div
            key={a.questionId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-white rounded-2xl border p-4 ${a.isCorrect ? 'border-green-100' : 'border-red-100'}`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {a.isCorrect
                  ? <CheckCircle className="w-5 h-5 text-green-500" />
                  : <XCircle className="w-5 h-5 text-red-500" />
                }
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800 mb-2">Q{i + 1}: {a.question}</p>
                <div className="space-y-1 text-xs">
                  <p className="text-gray-500">
                    {t('yourAnswer')}: <span className={`font-medium ${a.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {a.studentAnswer ?? t('notAnswered')}
                    </span>
                  </p>
                  {!a.isCorrect && a.correctAnswer && (
                    <p className="text-gray-500">
                      {t('correctAnswer')}: <span className="font-medium text-green-600">{a.correctAnswer}</span>
                    </p>
                  )}
                  {a.explanation && (
                    <p className="text-blue-500 mt-1 italic">💡 {a.explanation}</p>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">{a.points}/{a.maxPoints} pts</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <button
        onClick={() => router.push('/student/quizzes')}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
      >
        {t('backToQuizzes')}
      </button>
    </div>
  );

  // ===== Start Screen =====
  if (!started) return (
    <div className="p-6 max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center space-y-4"
      >
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">{quiz.title}</h2>
        <p className="text-gray-400 text-sm">{quiz.subject?.name ?? `Level ${quiz.academicYear}`}</p>

        <div className="grid grid-cols-3 gap-3 py-4">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-blue-600">{quiz.questions.length}</p>
            <p className="text-xs text-gray-400 mt-1">{t('questions')}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-purple-600">{quiz.timeLimit}</p>
            <p className="text-xs text-gray-400 mt-1">{t('minutes')}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-green-600">{quiz.passingScore}%</p>
            <p className="text-xs text-gray-400 mt-1">{t('toPass')}</p>
          </div>
        </div>

        {quiz.description && (
          <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">{quiz.description}</p>
        )}

        <p className="text-xs text-red-400 flex items-center justify-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {t('timerStartsImmediately')}
        </p>

        <button
          onClick={() => setStarted(true)}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
        >
          {t('startQuiz')}
        </button>
      </motion.div>
    </div>
  );

  // ===== Quiz Screen =====
  const question = quiz.questions[currentQ];
  const progress = ((currentQ + 1) / quiz.questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Timer + Progress */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500 font-medium">
            {t('questionOf')} {currentQ + 1} {t('of')} {quiz.questions.length}
          </span>
          <div className={`flex items-center gap-1.5 font-bold text-lg ${timerColor}`}>
            <Clock className="w-5 h-5" />
            {formatTime(timeLeft)}
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-gray-800 font-medium leading-relaxed">{question.question}</p>
            <span className="shrink-0 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium">
              {question.points} pt{question.points > 1 ? 's' : ''}
            </span>
          </div>

          {/* Options */}
          <div className="space-y-2">
            {question.type === 'TRUE_FALSE' ? (
              ['True', 'False'].map(val => (
                <OptionButton
                  key={val}
                  label={val}
                  selected={answers[question.id] === val}
                  onClick={() => setAnswers(p => ({ ...p, [question.id]: val }))}
                />
              ))
            ) : (
              question.options.map((opt, i) => (
                <OptionButton
                  key={i}
                  label={opt || `Option ${i + 1}`}
                  selected={answers[question.id] === String(i)}
                  onClick={() => setAnswers(p => ({ ...p, [question.id]: String(i) }))}
                  prefix={['A', 'B', 'C', 'D'][i]}
                />
              ))
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentQ(p => Math.max(0, p - 1))}
          disabled={currentQ === 0}
          className="p-3 bg-white border border-gray-200 rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        {/* Dots */}
        <div className="flex-1 flex items-center justify-center gap-1.5 flex-wrap">
          {quiz.questions.map((q, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                i === currentQ
                  ? 'bg-blue-600 text-white'
                  : answers[q.id]
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {currentQ < quiz.questions.length - 1 ? (
          <button
            onClick={() => setCurrentQ(p => Math.min(quiz.questions.length - 1, p + 1))}
            className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        ) : (
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? t('submitting') : `${t('submit')} (${answeredCount}/${quiz.questions.length})`}
          </button>
        )}
      </div>
    </div>
  );
}

function OptionButton({ label, selected, onClick, prefix }: {
  label: string; selected: boolean; onClick: () => void; prefix?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 text-gray-700'
      }`}
    >
      {prefix && (
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
          selected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
        }`}>
          {prefix}
        </span>
      )}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}