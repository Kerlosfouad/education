'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Building2, GraduationCap, Phone, BookOpen, CheckCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const academicYearsByDept: Record<string, { value: string; label: string }[]> = {
  PREP: [{ value: '0', label: 'Level 0' }],
  default: [
    { value: '1', label: 'Level 1' },
    { value: '2', label: 'Level 2' },
    { value: '3', label: 'Level 3' },
    { value: '4', label: 'Level 4' },
  ],
};

export default function CompleteProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [fullName, setFullName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDone, setIsDone] = useState(false);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const selectedDept = departments.find(d => d.id === departmentId);
  const academicYears = selectedDept?.code === 'PREP'
    ? academicYearsByDept['PREP']
    : academicYearsByDept['default'];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    // If student profile already complete, redirect
    if (status === 'authenticated' && (session?.user as any)?.student) {
      router.push('/dashboard');
      return;
    }
    fetch('/api/subjects/departments')
      .then(r => r.json())
      .then(json => { if (json.success) setDepartments(json.data); })
      .catch(() => {});
  }, [status, session, router]);

  // Fetch subjects when department + year selected
  useEffect(() => {
    if (!departmentId || !academicYear) { setSubjects([]); return; }
    setLoadingSubjects(true);
    fetch(`/api/subjects?departmentId=${departmentId}&academicYear=${academicYear}`)
      .then(r => r.json())
      .then(json => setSubjects(json.success ? json.data : []))
      .catch(() => setSubjects([]))
      .finally(() => setLoadingSubjects(false));
  }, [departmentId, academicYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentId || !academicYear || !studentCode) {
      setError('Please select department, academic year, and enter your student code');
      return;
    }
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!/^\d{5}$/.test(studentCode.trim())) {
      setError('Student code must be exactly 5 digits');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          departmentId,
          academicYear: parseInt(academicYear),
          studentCode: studentCode.trim(),
          phone: phone || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete profile');

      // Refresh session to pick up new student data
      await update({ refreshStatus: true });
      setIsDone(true);
      toast.success('Profile completed! Waiting for approval.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5 p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="border-0 shadow-xl text-center">
            <CardContent className="p-8">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Profile Complete!</h2>
              <p className="text-muted-foreground mb-6">
                Your account is pending approval from the doctor. You will be notified once approved.
              </p>
              <Button onClick={() => router.push('/auth/pending')} className="w-full bg-gradient-to-r from-primary to-purple-600">
                Go to Pending Page
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <Image src="/logo.jpeg" alt="logo" width={64} height={64} className="w-16 h-16 rounded-2xl object-cover" unoptimized />
            </div>
            <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
            <CardDescription>
              Welcome, {session?.user?.name}! Please enter your department, academic year, and your 5-digit student code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name (Three Parts) *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="e.g. Ahmed Mohamed Ali"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Department *</Label>
                <Select
                  value={departmentId}
                  onValueChange={(v) => { setDepartmentId(v); setAcademicYear(''); }}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999] bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700">
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id} className="dark:text-white dark:focus:bg-slate-700">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Academic Year *</Label>
                <Select
                  value={academicYear}
                  onValueChange={setAcademicYear}
                  disabled={isLoading || !departmentId}
                >
                  <SelectTrigger>
                    <GraduationCap className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999] bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700">
                    {academicYears.map(y => (
                      <SelectItem key={y.value} value={y.value} className="dark:text-white dark:focus:bg-slate-700">{y.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subjects preview */}
              {departmentId && academicYear && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    Your Subjects
                  </Label>
                  {loadingSubjects ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading subjects...
                    </div>
                  ) : subjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground bg-slate-50 rounded-xl px-4 py-3">
                      No subjects assigned yet for this level.
                    </p>
                  ) : (
                    <div className="bg-indigo-50 rounded-xl px-4 py-3 flex flex-wrap gap-2">
                      {subjects.map(s => (
                        <span key={s.id} className="text-xs font-semibold bg-white text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Student Code *</Label>                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="e.g. 971304"
                  value={studentCode}
                  onChange={e => setStudentCode(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label>Phone Number (optional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-purple-600"
                disabled={isLoading}
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  'Complete Registration'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/auth/login' })}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sign out and use a different account
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
