import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dr. Emad Bayuome Educational System',
  description: 'Advanced educational management platform for students and faculty',
  keywords: ['education', 'learning', 'students', 'university', 'e-learning'],
  authors: [{ name: 'Dr. Emad Bayuome' }],
  openGraph: {
    title: 'Dr. Emad Bayuome Educational System',
    description: 'Advanced educational management platform',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
