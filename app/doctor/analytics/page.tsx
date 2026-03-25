'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, BookOpen, ClipboardList, Calendar, Search, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

type StudentAnalytics = {
  id: string;
  name: string;
  studentCode: string;
  attendanceRate: number;
  quizRate: number;
  assignmentRate: number;
  avgQuizScore: number;
  attendanceCount: number;
  quizCount: number;
  assignmentCount: number;
  totalSessions: number;
  totalQuizzes: number;
  totalAssignments: number;
};

export default function AnalyticsPage() {
  const [students, setStudents] = useState<StudentAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/doctor/analytics')
      .then(r => r.json())
      .then(data => {
        setStudents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.studentCode.includes(search)
  );

  const avgAttendance = filtered.length
    ? Math.round(filtered.reduce((a, s) => a + s.attendanceRate, 0) / filtered.length) : 0;
  const avgQuiz = filtered.length
    ? Math.round(filtered.reduce((a, s) => a + s.quizRate, 0) / filtered.length) : 0;
  const avgAssignment = filtered.length
    ? Math.round(filtered.reduce((a, s) => a + s.assignmentRate, 0) / filtered.length) : 0;

  // Bar chart data - top 8 students by name
  const barData = filtered.slice(0, 8).map(s => ({
    name: s.name.split(' ')[0],
    Attendance: s.attendanceRate,
    Quizzes: s.quizRate,
    Assignments: s.assignmentRate,
  }));

  // Radar chart - overall averages
  const radarData = [
    { metric: 'Attendance', value: avgAttendance },
    { metric: 'Quiz Completion', value: avgQuiz },
    { metric: 'Assignments', value: avgAssignment },
    { metric: 'Avg Score', value: filtered.length ? Math.round(filtered.reduce((a, s) => a + s.avgQuizScore, 0) / filtered.length) : 0 },
  ];

  // Pie chart - performance distribution
  const excellent = filtered.filter(s => (s.attendanceRate + s.quizRate + s.assignmentRate) / 3 >= 80).length;
  const good = filtered.filter(s => { const v = (s.attendanceRate + s.quizRate + s.assignmentRate) / 3; return v >= 60 && v < 80; }).length;
  const average = filtered.filter(s => { const v = (s.attendanceRate + s.quizRate + s.assignmentRate) / 3; return v >= 40 && v < 60; }).length;
  const poor = filtered.filter(s => (s.attendanceRate + s.quizRate + s.assignmentRate) / 3 < 40).length;
  const pieData = [
    { name: 'Excellent', value: excellent, color: '#22c55e' },
    { name: 'Good', value: good, color: '#3b82f6' },
    { name: 'Average', value: average, color: '#eab308' },
    { name: 'Poor', value: poor, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Student Analytics</h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">Performance overview across attendance, quizzes & assignments</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <OverviewCard icon={<Calendar className="w-5 h-5" />} label="Avg Attendance" value={`${avgAttendance}%`} color="blue" />
        <OverviewCard icon={<BookOpen className="w-5 h-5" />} label="Avg Quiz Completion" value={`${avgQuiz}%`} color="purple" />
        <OverviewCard icon={<ClipboardList className="w-5 h-5" />} label="Avg Assignment Submission" value={`${avgAssignment}%`} color="green" />
      </div>

      {/* Charts Section */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bar Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-[#0f1f38] rounded-2xl border border-gray-100 dark:border-[#1a2f4a] shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 dark:text-white mb-4">Student Performance Comparison</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barSize={10} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number | string) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Attendance" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Quizzes" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Assignments" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-white dark:bg-[#0f1f38] rounded-2xl border border-gray-100 dark:border-[#1a2f4a] shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 dark:text-white mb-4">Performance Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number | string) => `${v} students`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Chart */}
          <div className="lg:col-span-3 bg-white dark:bg-[#0f1f38] rounded-2xl border border-gray-100 dark:border-[#1a2f4a] shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 dark:text-white mb-4">Overall Class Performance Radar</h3>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Class Avg" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                <Tooltip formatter={(v: number | string) => `${v}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search student..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-[#1a2f4a] dark:bg-[#0d1e35] dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Students List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((student, i) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white dark:bg-[#0f1f38] rounded-2xl border border-gray-100 dark:border-[#1a2f4a] shadow-sm p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  {student.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{student.name}</p>
                  <p className="text-xs text-gray-400">{student.studentCode}</p>
                </div>
                <div className="ml-auto">
                  <PerformanceBadge value={Math.round((student.attendanceRate + student.quizRate + student.assignmentRate) / 3)} />
                </div>
              </div>
              <div className="space-y-3">
                <MetricBar icon={<Calendar className="w-3.5 h-3.5" />} label="Attendance" value={student.attendanceRate} detail={`${student.attendanceCount} / ${student.totalSessions} sessions`} color="blue" />
                <MetricBar icon={<BookOpen className="w-3.5 h-3.5" />} label="Quiz Completion" value={student.quizRate} detail={`${student.quizCount} / ${student.totalQuizzes} quizzes`} color="purple" />
                <MetricBar icon={<ClipboardList className="w-3.5 h-3.5" />} label="Assignment Submission" value={student.assignmentRate} detail={`${student.assignmentCount} / ${student.totalAssignments} assignments`} color="green" />
                <MetricBar icon={<TrendingUp className="w-3.5 h-3.5" />} label="Avg Quiz Score" value={student.avgQuizScore} detail={`${student.avgQuizScore}%`} color="orange" />
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No students found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OverviewCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', purple: 'bg-purple-50 text-purple-600', green: 'bg-green-50 text-green-600',
  };
  return (
    <div className={`rounded-2xl p-5 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2 opacity-70">{icon}<span className="text-sm font-medium">{label}</span></div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function MetricBar({ icon, label, value, detail, color }: { icon: React.ReactNode; label: string; value: number; detail: string; color: string }) {
  const barColors: Record<string, string> = { blue: 'bg-blue-400', purple: 'bg-purple-400', green: 'bg-green-400', orange: 'bg-orange-400' };
  const textColors: Record<string, string> = { blue: 'text-blue-600', purple: 'text-purple-600', green: 'text-green-600', orange: 'text-orange-600' };
  return (
    <div className="flex items-center gap-3">
      <div className={`shrink-0 ${textColors[color]}`}>{icon}</div>
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500 font-medium">{label}</span>
          <span className="text-gray-400">{detail}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div className={`h-full rounded-full ${barColors[color]}`} initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
        </div>
      </div>
      <span className={`text-sm font-bold shrink-0 ${textColors[color]}`}>{value}%</span>
    </div>
  );
}

function PerformanceBadge({ value }: { value: number }) {
  const level = value >= 80 ? { label: 'Excellent', cls: 'bg-green-100 text-green-700' }
    : value >= 60 ? { label: 'Good', cls: 'bg-blue-100 text-blue-700' }
    : value >= 40 ? { label: 'Average', cls: 'bg-yellow-100 text-yellow-700' }
    : { label: 'Poor', cls: 'bg-red-100 text-red-700' };
  return <span className={`text-xs font-semibold px-3 py-1 rounded-full ${level.cls}`}>{level.label}</span>;
}
