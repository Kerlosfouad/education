import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/shell';
import { DashboardNav } from '@/components/dashboard/nav';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  const hasStudentProfile = !!(session.user as any).student;

  if (!hasStudentProfile) {
    redirect('/auth/complete-profile');
  }

  if (session.user.status === 'PENDING') {
    redirect('/auth/pending');
  }

  return (
    <DashboardShell>
      <DashboardNav user={{
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? '',
        image: session.user.image ?? null,
        role: session.user.role,
      }} />
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {children}
      </main>
    </DashboardShell>
  );
}
