'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'en' | 'ar';

type Dict = Record<string, { en: string; ar: string }>;

const dict: Dict = {
  // Common
  dashboard: { en: 'Dashboard', ar: 'لوحة التحكم' },
  attendance: { en: 'Attendance', ar: 'الحضور' },
  assignments: { en: 'Assignments', ar: 'الواجبات' },
  quizzes: { en: 'Quizzes', ar: 'الاختبارات' },
  liveSessions: { en: 'Live Sessions', ar: 'محاضرات مباشرة' },
  videos: { en: 'Videos', ar: 'فيديوهات' },
  eLibrary: { en: 'E-Library', ar: 'المكتبة الإلكترونية' },
  notifications: { en: 'Notifications', ar: 'الإشعارات' },
  settings: { en: 'Settings', ar: 'الإعدادات' },
  logout: { en: 'Logout', ar: 'تسجيل الخروج' },
  students: { en: 'Students', ar: 'الطلاب' },
  lectures: { en: 'Lectures', ar: 'المحاضرات' },
  slides: { en: 'Slides', ar: 'السلايدز' },
  results: { en: 'Results', ar: 'النتائج' },
  analytics: { en: 'Analytics', ar: 'الإحصائيات' },

  // Landing
  login: { en: 'Login', ar: 'تسجيل الدخول' },
  register: { en: 'Register', ar: 'إنشاء حساب' },
  getStarted: { en: 'Get Started', ar: 'ابدأ الآن' },
  createAccount: { en: 'Create Account', ar: 'إنشاء حساب' },
  educationalSystem: { en: 'Educational System', ar: 'النظام التعليمي' },
  scanToAccess: { en: 'Scan to Access', ar: 'امسح للوصول' },
  scanHint: {
    en: 'Scan the QR code from your book to quickly access the platform',
    ar: 'امسح كود QR من كتابك للوصول السريع إلى المنصة',
  },

  // Attendance (doctor)
  errorOccurred: { en: 'An error occurred', ar: 'حدث خطأ' },
  sessionsTab: { en: 'Sessions', ar: 'الجلسات' },
  attendanceTable: { en: 'Attendance Table', ar: 'جدول الحضور' },
  open: { en: 'Open', ar: 'مفتوح' },
  closed: { en: 'Closed', ar: 'مغلق' },
  deleteSession: { en: 'Delete session', ar: 'حذف الجلسة' },
  present: { en: 'Present', ar: 'حضر' },
  absent: { en: 'Absent', ar: 'غاب' },
  closeSession: { en: 'Close session', ar: 'إغلاق الجلسة' },
  openSession: { en: 'Open session', ar: 'فتح الجلسة' },
  notEnoughData: { en: 'Not enough data to display the table', ar: 'لا توجد بيانات كافية لعرض الجدول' },
  student: { en: 'Student', ar: 'الطالب' },
  percentage: { en: 'Percentage', ar: 'النسبة' },
  newAttendanceSession: { en: 'New Attendance Session', ar: 'جلسة حضور جديدة' },
  subject: { en: 'Subject', ar: 'المادة' },
  selectSubject: { en: 'Select subject', ar: 'اختر المادة' },
  sessionTitleOptional: { en: 'Session title (optional)', ar: 'عنوان الجلسة (اختياري)' },
  openTime: { en: 'Open time', ar: 'وقت الفتح' },
  closeTime: { en: 'Close time', ar: 'وقت الإغلاق' },
  saving: { en: 'Saving...', ar: 'جاري الحفظ...' },
  createSession: { en: 'Create session', ar: 'إنشاء الجلسة' },
  // Student pages
  attendanceRecorded: { en: 'Attendance Recorded!', ar: 'تم تسجيل الحضور!' },
  attendanceMarkedFor: { en: 'Your attendance has been marked for', ar: 'تم تسجيل حضورك لمادة' },
  markAttendance: { en: 'Mark Attendance', ar: 'تسجيل الحضور' },
  openAttendanceSession: { en: 'There is an open attendance session', ar: 'هناك جلسة حضور مفتوحة' },
  later: { en: 'Later', ar: 'لاحقًا' },
  welcome: { en: 'Welcome', ar: 'مرحبًا' },
  viewAll: { en: 'View all', ar: 'عرض الكل' },
  noQuizzesAvailable: { en: 'No quizzes available', ar: 'لا توجد اختبارات متاحة' },
  noAssignmentsYet: { en: 'No assignments yet', ar: 'لا توجد واجبات بعد' },
  noUpcomingSessions: { en: 'No upcoming sessions', ar: 'لا توجد محاضرات قادمة' },
  noVideosYet: { en: 'No videos yet', ar: 'لا توجد فيديوهات بعد' },
  noBooksYet: { en: 'No books yet', ar: 'لا توجد كتب بعد' },
  join: { en: 'Join', ar: 'انضم' },
  watch: { en: 'Watch', ar: 'مشاهدة' },
  attendanceSessionOpen: { en: 'Attendance session is open', ar: 'جلسة الحضور مفتوحة' },
  attendanceRecordedShort: { en: 'Attendance recorded', ar: 'تم تسجيل الحضور' },
  closesAt: { en: 'closes at', ar: 'تغلق الساعة' },
  marking: { en: 'Marking...', ar: 'جاري التسجيل...' },
  lecturesAttended: { en: 'Lectures attended', ar: 'محاضرات حضرتها' },
  lecturesMissed: { en: 'Lectures missed', ar: 'محاضرات غبت عنها' },
  attendanceRateLabel: { en: 'Attendance rate', ar: 'نسبة الحضور' },
  attendanceRecord: { en: 'Attendance Record', ar: 'سجل الحضور' },
  noAttendanceRecords: { en: 'No attendance records yet.', ar: 'لا يوجد سجل حضور بعد.' },
  trackYourAttendanceAcrossAllLectures: { en: 'Track your attendance across all lectures.', ar: 'تابع حضورك في كل المحاضرات.' },
  presentStatus: { en: 'Present', ar: 'حاضر' },
  absentStatus: { en: 'Absent', ar: 'غائب' },
  allLectureVideos: { en: 'All lecture videos', ar: 'كل فيديوهات المحاضرات' },
  noVideosAvailable: { en: 'No videos available yet', ar: 'لا توجد فيديوهات متاحة بعد' },
  booksReferences: { en: 'Books, references, and study materials', ar: 'كتب ومراجع ومواد دراسية' },
  searchBook: { en: 'Search for a book...', ar: 'ابحث عن كتاب...' },
  noLibraryFiles: { en: 'No files in the library yet', ar: 'لا توجد ملفات في المكتبة بعد' },
  liveAndRecorded: { en: 'Live and recorded lectures', ar: 'محاضرات مباشرة ومسجلة' },
  upcoming: { en: 'Upcoming', ar: 'قادمة' },
  past: { en: 'Past', ar: 'سابقة' },
  noPastSessions: { en: 'No past sessions', ar: 'لا توجد جلسات سابقة' },
  joinSession: { en: 'Join Session', ar: 'انضم للجلسة' },
  watchRecording: { en: 'Watch Recording', ar: 'مشاهدة التسجيل' },
  myQuizzes: { en: 'My Quizzes', ar: 'اختباراتي' },
  takeQuizzesBeforeDeadline: { en: 'Take your quizzes before the deadline', ar: 'ابدأ اختباراتك قبل الموعد النهائي' },
  noQuizzesYet: { en: 'No quizzes available yet', ar: 'لا توجد اختبارات بعد' },
  questions: { en: 'Questions', ar: 'أسئلة' },
  pass: { en: 'Pass', ar: 'النجاح' },
  deadline: { en: 'Deadline', ar: 'الموعد النهائي' },
  score: { en: 'Score', ar: 'الدرجة' },
  passed: { en: 'Passed', ar: 'ناجح' },
  failed: { en: 'Failed', ar: 'راسب' },
  startQuiz: { en: 'Start Quiz', ar: 'ابدأ الاختبار' },
  viewResult: { en: 'View Result', ar: 'عرض النتيجة' },
  expired: { en: 'Expired', ar: 'منتهي' },
  quizNotFound: { en: 'Quiz not found', ar: 'الاختبار غير موجود' },
  congratulations: { en: 'Congratulations!', ar: 'مبروك!' },
  keepTrying: { en: 'Keep Trying!', ar: 'حاول مرة أخرى!' },
  points: { en: 'points', ar: 'نقطة' },
  answerReview: { en: 'Answer Review', ar: 'مراجعة الإجابات' },
  yourAnswer: { en: 'Your answer', ar: 'إجابتك' },
  notAnswered: { en: 'Not answered', ar: 'لم تتم الإجابة' },
  correctAnswer: { en: 'Correct answer', ar: 'الإجابة الصحيحة' },
  backToQuizzes: { en: 'Back to Quizzes', ar: 'العودة للاختبارات' },
  minutes: { en: 'Minutes', ar: 'دقائق' },
  toPass: { en: 'To Pass', ar: 'للنجاح' },
  timerStartsImmediately: { en: 'Timer starts immediately when you click Start', ar: 'المؤقت يبدأ فور الضغط على ابدأ' },
  questionOf: { en: 'Question', ar: 'سؤال' },
  of: { en: 'of', ar: 'من' },
  submitting: { en: 'Submitting...', ar: 'جاري الإرسال...' },
  submit: { en: 'Submit', ar: 'إرسال' },
  failedToSubmitQuiz: { en: 'Failed to submit quiz', ar: 'فشل إرسال الاختبار' },
  networkErrorPleaseTryAgain: { en: 'Network error, please try again', ar: 'خطأ بالشبكة، حاول مرة أخرى' },
  allYourPendingAndSubmittedAssignments: { en: 'All your pending and submitted assignments', ar: 'كل واجباتك الحالية والمُرسلة' },
  general: { en: 'General', ar: 'عام' },
  submitted: { en: 'Submitted', ar: 'تم التسليم' },
  overdue: { en: 'Overdue', ar: 'متأخر' },
  pending: { en: 'Pending', ar: 'قيد الانتظار' },
  maxScore: { en: 'Max score', ar: 'الدرجة النهائية' },
  yourScore: { en: 'Your score', ar: 'درجتك' },
  openAssignment: { en: 'Open Assignment', ar: 'فتح الواجب' },
  yourSubmission: { en: 'Your submission', ar: 'تسليمك' },
  availableQuizzes: { en: 'Available Quizzes', ar: 'الاختبارات المتاحة' },
  pendingAssignments: { en: 'Pending Assignments', ar: 'الواجبات المعلقة' },
  videosAvailable: { en: 'Videos Available', ar: 'الفيديوهات المتاحة' },
  somethingWentWrong: { en: 'Something went wrong', ar: 'حدث خطأ ما' },
  createManageQuizzes: { en: 'Create and manage your quizzes', ar: 'أنشئ وأدر اختباراتك' },
  newQuiz: { en: 'New Quiz', ar: 'اختبار جديد' },
  noQuizzesCreateFirst: { en: 'No quizzes yet. Create your first quiz!', ar: 'لا توجد اختبارات بعد. أنشئ أول اختبار!' },
  published: { en: 'Published', ar: 'منشور' },
  draft: { en: 'Draft', ar: 'مسودة' },
  attempts: { en: 'Attempts', ar: 'محاولات' },
  start: { en: 'Start', ar: 'البداية' },
  end: { en: 'End', ar: 'النهاية' },
  publish: { en: 'Publish', ar: 'نشر' },
  unpublish: { en: 'Unpublish', ar: 'إلغاء النشر' },
  uploadManageVideos: { en: 'Upload and manage your lecture videos', ar: 'ارفع وأدر فيديوهات المحاضرات' },
  uploadVideo: { en: 'Upload Video', ar: 'رفع فيديو' },
  searchVideos: { en: 'Search videos...', ar: 'ابحث في الفيديوهات...' },
  noVideosUploadFirst: { en: 'No videos yet. Upload your first video!', ar: 'لا توجد فيديوهات بعد. ارفع أول فيديو!' },
  createAssignmentsAndGrade: { en: 'Create assignments and grade student submissions.', ar: 'أنشئ الواجبات وقيّم تسليمات الطلاب.' },
  createNewAssignment: { en: 'Create New Assignment', ar: 'إنشاء واجب جديد' },
  allAssignments: { en: 'All Assignments', ar: 'كل الواجبات' },
  noSubmissionsYet: { en: 'No submissions yet', ar: 'لا توجد تسليمات بعد' },
};

type I18nContextValue = {
  lang: Lang;
  t: (key: keyof typeof dict | string) => string;
  dir: 'ltr';
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang] = useState<Lang>('en');

  const value = useMemo<I18nContextValue>(() => {
    return {
      lang,
      t: (key) => {
        const entry = (dict as Dict)[key];
        if (!entry) return String(key);
        return entry.en;
      },
      dir: 'ltr',
    };
  }, [lang]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dir = value.dir;
    document.documentElement.lang = 'en';
  }, [value.dir]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

