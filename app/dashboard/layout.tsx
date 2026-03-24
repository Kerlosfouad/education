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

  if (session.user.status === 'PENDING') {
    redirect('/auth/pending');
  }

  return (
    <DashboardShell>
      <DashboardNav user={session.user} />
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {children}
      </main>
    </DashboardShell>
  );
}
