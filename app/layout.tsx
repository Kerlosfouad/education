import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import { InstallPWA } from '@/components/InstallPWA';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dr. Emad Bayuome Educational System',
  description: 'Advanced educational management platform for students and faculty',
  keywords: ['education', 'learning', 'students', 'university', 'e-learning'],
  authors: [{ name: 'Dr. Emad Bayuome' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Dr. Emad Edu',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'Dr. Emad Bayuome Educational System',
    description: 'Advanced educational management platform',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Dr. Emad Edu" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
          <InstallPWA />
        </Providers>
      </body>
    </html>
  );
}
