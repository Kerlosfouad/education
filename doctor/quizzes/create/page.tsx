'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ChevronLeft, Save, Clock, Target, BookOpen } from 'lucide-react';

type Question = {
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
};

type Subject = { id: string; name: string };

const academicYearsByDept: Record<string, { value: number; label: string }[]> = {
  PREP: [{ value: 1, label: 'First Year' }],
  default: [
    { value: 2, label: 'Second Year' },
    { value: 3, label: 'Third Year' },
    { value: 4, label: 'Fourth Year' },
    { value: 5, label: 'Fifth Year' },
  ],
};

export default function CreateQuizPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    departmentId: '',
    academicYear: 0,
    timeLimit: 30,
    maxAttempts: 1,
    passingScore: 60,
    shuffleQuestions: true,
    showCorrectAnswers: true,
    startTime: '',
    endTime: '',
  });

  const [questions, setQuestions] = useState<Question[]>([
    { type: 'MULTIPLE_CHOICE', question: '', options: ['', '', '', ''], correctAnswer: '0', explanation: '', points: 1 },
  ]);

  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);

  useEffect(() => {
    fetch('/api/subjects/departments').then(r => r.json()).then(j => { if (j.success) setDepartments(j.data); });
  }, []);

  const selectedDept = departments.find(d => d.id === form.departmentId);
  const academicYears = selectedDept?.code === 'PREP'
    ? academicYearsByDept['PREP']
    : academicYearsByDept['default'];

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      type: 'MULTIPLE_CHOICE',
      question: '',
      options: ['', '', '', ''],
      correctAnswer: '0',
      explanation: '',
      points: 1,
    }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIndex) return q;
      const newOptions = [...q.options];
      newOptions[oIndex] = value;
      return { ...q, options: newOptions };
    }));
  };

  const handleSubmit = async (publish: boolean) => {
    setError('');
    if (!form.title || !form.departmentId || !form.academicYear || questions.some(q => !q.question)) {
      setError('Please fill all required fields (title, department, academic year, and all questions)');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          timeLimit: Number(form.timeLimit),
          maxAttempts: Number(form.maxAttempts),
          passingScore: Number(form.passingScore),
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          isPublished: publish,
          questions,
        }),
      });

      const text = await res.text();
      if (!text) {
        setError('Server returned empty response. Check your API.');
        return;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        setError(`Invalid response: ${text.slice(0, 100)}`);
        return;
      }

      if (!res.ok) {
        setError(data?.error || `Error ${res.status}`);
        return;
      }

      if (data.success) {
        router.push('/doctor/quizzes');
      } else {
        setError(data?.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Create New Quiz</h1>
          <p className="text-gray-400 text-sm">Fill in the details and add questions</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Quiz Settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-500" /> Quiz Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-600 mb-1 block">Quiz Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Chapter 3 Quiz"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-600 mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description..."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Department *</label>
            <select
              value={form.departmentId}
              onChange={e => setForm(p => ({ ...p, departmentId: e.target.value, academicYear: 0 }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select department...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Academic Year *</label>
            <select
              value={form.academicYear || ''}
              onChange={e => setForm(p => ({ ...p, academicYear: Number(e.target.value) }))}
              disabled={!form.departmentId}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">Select year...</option>
              {academicYears.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">
              <Clock className="w-3.5 h-3.5 inline mr-1" /> Time Limit (minutes) *
            </label>
            <input
              type="number" min={1}
              value={form.timeLimit}
              onChange={e => setForm(p => ({ ...p, timeLimit: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">
              <Target className="w-3.5 h-3.5 inline mr-1" /> Passing Score (%)
            </label>
            <input
              type="number" min={0} max={100}
              value={form.passingScore}
              onChange={e => setForm(p => ({ ...p, passingScore: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Max Attempts</label>
            <input
              type="number" min={1}
              value={form.maxAttempts}
              onChange={e => setForm(p => ({ ...p, maxAttempts: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Start Time</label>
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">End Time</label>
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-6 pt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.shuffleQuestions}
              onChange={e => setForm(p => ({ ...p, shuffleQuestions: e.target.checked }))}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-sm text-gray-600">Shuffle Questions</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showCorrectAnswers}
              onChange={e => setForm(p => ({ ...p, showCorrectAnswers: e.target.checked }))}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-sm text-gray-600">Show Correct Answers After Submit</span>
          </label>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-700">Questions ({questions.length})</h2>

        <AnimatePresence>
          {questions.map((q, qIndex) => (
            <motion.div
              key={qIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  Q{qIndex + 1}
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={q.type}
                    onChange={e => updateQuestion(qIndex, 'type', e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                  >
                    <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                    <option value="TRUE_FALSE">True / False</option>
                  </select>
                  <input
                    type="number" min={1}
                    value={q.points}
                    onChange={e => updateQuestion(qIndex, 'points', Number(e.target.value))}
                    className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none text-center"
                    title="Points"
                  />
                  {questions.length > 1 && (
                    <button onClick={() => removeQuestion(qIndex)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={q.question}
                onChange={e => updateQuestion(qIndex, 'question', e.target.value)}
                placeholder="Enter your question..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />

              {q.type === 'MULTIPLE_CHOICE' ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Options (select correct answer)</p>
                  {q.options.map((opt, oIndex) => (
                    <div key={oIndex} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={q.correctAnswer === String(oIndex)}
                        onChange={() => updateQuestion(qIndex, 'correctAnswer', String(oIndex))}
                        className="accent-indigo-600"
                      />
                      <input
                        value={opt}
                        onChange={e => updateOption(qIndex, oIndex, e.target.value)}
                        placeholder={`Option ${oIndex + 1}`}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Select correct answer</p>
                  <div className="flex gap-4">
                    {['True', 'False'].map(val => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`tf-${qIndex}`}
                          checked={q.correctAnswer === val}
                          onChange={() => updateQuestion(qIndex, 'correctAnswer', val)}
                          className="accent-indigo-600"
                        />
                        <span className="text-sm text-gray-700">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <input
                value={q.explanation}
                onChange={e => updateQuestion(qIndex, 'explanation', e.target.value)}
                placeholder="Explanation (optional, shown after submit)"
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </motion.div>
          ))}
        </AnimatePresence>

        <button
          onClick={addQuestion}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Question
        </button>
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-3 pb-10">
        <button
          onClick={() => handleSubmit(false)}
          disabled={saving}
          className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50"
        >
          Save as Draft
        </button>
        <button
          onClick={() => handleSubmit(true)}
          disabled={saving}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Publish Quiz'}
        </button>
      </div>
    </div>
  );
}
