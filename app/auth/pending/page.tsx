'use client';

import { useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Clock, Mail, LogOut, BookOpen, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import Image from 'next/image';

export default function PendingApprovalPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (session?.user?.status === 'ACTIVE') {
      toast.success('Account approved! Welcome!');
      window.location.href = '/student/dashboard';
      return;
    }

    if (status === 'authenticated' && session?.user?.status === 'PENDING') {
      intervalRef.current = setInterval(async () => {
        const res = await fetch('/api/auth/check-status');
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ACTIVE') {
            clearInterval(intervalRef.current!);
            await update({ refreshStatus: true });
            toast.success('Your account has been approved!');
            window.location.href = '/student/dashboard';
          }
        }
      }, 5000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session, status, router, update]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/login' });
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <Image src="/logo.jpeg" alt="logo" width={64} height={64} className="w-16 h-16 rounded-2xl object-cover" unoptimized />
            </div>
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-amber-600 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Waiting for Approval</h2>
            <p className="text-muted-foreground mb-6">
              Your account is under review. You will be redirected automatically once the doctor approves your account.
            </p>
            <div className="bg-muted rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium">Auto-redirect enabled</p>
                  <p className="text-xs text-muted-foreground">This page checks for approval every 5 seconds</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>Registration submitted</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin shrink-0" />
                <span>Pending doctor approval...</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground opacity-40">
                <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                <span>Account activation</span>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t">
              <Button variant="outline" onClick={handleLogout} className="w-full">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
