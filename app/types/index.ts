import { UserRole, UserStatus, SubmissionStatus, QuestionType, AttemptStatus, LibraryCategory, NotificationType } from '@prisma/client';

// Re-export enums
export { UserRole, UserStatus, SubmissionStatus, QuestionType, AttemptStatus, LibraryCategory, NotificationType };

// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  student?: Student;
  doctorProfile?: DoctorProfile;
  adminProfile?: AdminProfile;
}

export interface Student {
  id: string;
  userId: string;
  studentCode: string;
  departmentId: string;
  academicYear: number;
  phone: string | null;
  barcode: string | null;
  qrCode: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  department: Department;
}

export interface DoctorProfile {
  id: string;
  userId: string;
  title: string | null;
  bio: string | null;
  specialties: string[];
}

export interface AdminProfile {
  id: string;
  userId: string;
  permissions: string[];
}

// Department types
export interface Department {
  id: string;
  name: string;
  nameAr: string | null;
  code: string;
  description: string | null;
  level: number;
  isActive: boolean;
  createdAt: Date;
}

// Subject types
export interface Subject {
  id: string;
  name: string;
  code: string;
  description: string | null;
  departmentId: string;
  academicYear: number;
  semester: number;
  doctorId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  department: Department;
  doctor?: DoctorProfile;
}

// Attendance types
export interface AttendanceSession {
  id: string;
  subjectId: string;
  title: string | null;
  openTime: Date;
  closeTime: Date;
  isOpen: boolean;
  createdBy: string;
  createdAt: Date;
  subject: Subject;
  attendances: Attendance[];
  _count?: {
    attendances: number;
  };
}

export interface Attendance {
  id: string;
  studentId: string;
  sessionId: string;
  timestamp: Date;
  deviceInfo: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
  verificationMethod: string;
  student: Student;
  session: AttendanceSession;
}

// Assignment types
export interface Assignment {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  deadline: Date;
  maxScore: number;
  allowUpload: boolean;
  fileUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  subject: Subject;
  submissions: AssignmentSubmission[];
  _count?: {
    submissions: number;
  };
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  fileUrl: string | null;
  notes: string | null;
  submittedAt: Date;
  score: number | null;
  feedback: string | null;
  gradedAt: Date | null;
  gradedBy: string | null;
  status: SubmissionStatus;
  assignment: Assignment;
  student: Student;
}

// Quiz types
export interface Quiz {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  timeLimit: number;
  maxAttempts: number;
  passingScore: number;
  shuffleQuestions: boolean;
  showCorrectAnswers: boolean;
  isPublished: boolean;
  startTime: Date | null;
  endTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
  subject: Subject;
  questions: Question[];
  attempts: QuizAttempt[];
  _count?: {
    questions: number;
    attempts: number;
  };
}

export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  points: number;
  order: number;
  quiz: Quiz;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: Date;
  completedAt: Date | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  answers: Record<string, string> | null;
  timeSpent: number | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  status: AttemptStatus;
  quiz: Quiz;
  student: Student;
}

// Lecture types
export interface ZoomLecture {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  meetingUrl: string;
  meetingId: string | null;
  password: string | null;
  scheduledAt: Date;
  duration: number;
  isRecorded: boolean;
  recordingUrl: string | null;
  createdAt: Date;
  subject: Subject;
}

export interface LectureSlide {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  fileSize: number | null;
  order: number;
  uploadedAt: Date;
  uploadedBy: string;
  subject: Subject;
}

// E-Library types
export interface ELibraryItem {
  id: string;
  subjectId: string | null;
  title: string;
  author: string | null;
  description: string | null;
  category: LibraryCategory;
  fileUrl: string | null;
  externalUrl: string | null;
  coverImage: string | null;
  isActive: boolean;
  createdAt: Date;
  subject?: Subject;
}

// Exam result types
export interface ExamResult {
  id: string;
  subjectId: string;
  studentId: string;
  examType: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade: string | null;
  semester: number;
  academicYear: number;
  notes: string | null;
  publishedAt: Date;
  publishedBy: string;
  subject: Subject;
  student: Student;
}

// Notification types
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  data: Record<string, unknown> | null;
  createdAt: Date;
  user: User;
}

// Login history types
export interface LoginHistory {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  location: string | null;
  status: string;
  createdAt: Date;
  user: User;
}

// System config types
export interface SystemConfig {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

// Role rule types
export interface RoleRule {
  id: string;
  pattern: string;
  role: UserRole;
  priority: number;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Dashboard stats types
export interface DashboardStats {
  totalStudents: number;
  pendingApprovals: number;
  totalSubjects: number;
  totalQuizzes: number;
  todayAttendance: number;
  recentSubmissions: number;
}

export interface StudentDashboardStats {
  enrolledSubjects: number;
  upcomingQuizzes: number;
  pendingAssignments: number;
  attendanceRate: number;
  recentGrades: ExamResult[];
}

// Form types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  studentCode?: string;
  departmentId?: string;
  academicYear?: number;
  phone?: string;
}

export interface QuizFormData {
  title: string;
  description?: string;
  timeLimit: number;
  maxAttempts: number;
  passingScore: number;
  shuffleQuestions: boolean;
  showCorrectAnswers: boolean;
  startTime?: Date;
  endTime?: Date;
  questions: {
    question: string;
    type: QuestionType;
    options: string[];
    correctAnswer: string;
    explanation?: string;
    points: number;
  }[];
}

// Session types for NextAuth
export interface ExtendedSession {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role: UserRole;
    status: UserStatus;
    student?: Student;
    doctorProfile?: DoctorProfile;
    adminProfile?: AdminProfile;
  };
  expires: string;
}

// Filter and pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  departmentId?: string;
  academicYear?: number;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}
