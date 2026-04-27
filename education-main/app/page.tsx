'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';
import { useTheme } from 'next-themes';
import QRCode from 'qrcode';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { LOGO_BASE64 } from '@/lib/logo';
import { 
  BookOpen, 
  GraduationCap, 
  QrCode, 
  Download, 
  LogIn, 
  UserPlus,
  ChevronRight,
  Star,
  Users,
  Calendar,
  Award,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

const features = [
  {
    icon: QrCode,
    title: 'Smart QR Access',
    description: 'Scan QR codes from your book to instantly access course materials',
  },
  {
    icon: GraduationCap,
    title: 'Interactive Learning',
    description: 'Engage with quizzes, assignments, and live lectures',
  },
  {
    icon: Calendar,
    title: 'Attendance Tracking',
    description: 'Digital attendance system with real-time verification',
  },
  {
    icon: Award,
    title: 'Progress Monitoring',
    description: 'Track your academic progress and exam results',
  },
];

// Stats with numeric targets for the counter animation
const stats = [
  { target: 10000, suffix: 'K+', divisor: 1000, label: 'Students' },
  { target: 50, suffix: '+', divisor: 1, label: 'Courses' },
  { target: 100, suffix: '+', divisor: 1, label: 'Quizzes' },
  { target: 99, suffix: '%', divisor: 1, label: 'Satisfaction' },
];

// Animated counter component
function AnimatedCounter({ target, suffix, divisor, duration = 2 }: {
  target: number;
  suffix: string;
  divisor: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: duration * 1000, bounce: 0 });
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (inView) motionVal.set(target);
  }, [inView, motionVal, target]);

  useEffect(() => {
    return spring.on('change', (v) => {
      const val = divisor > 1 ? (v / divisor).toFixed(0) : Math.floor(v).toString();
      setDisplay(val);
    });
  }, [spring, divisor]);

  return (
    <span ref={ref}>
      {display}{suffix}
    </span>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [doctorName] = useState<string>('DR. EMAD BAYUOME');
  const { theme, setTheme } = useTheme();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      return;
    }
  };
  const { data: session, status: authStatus } = useSession();
  const { t } = useI18n();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Generate real QR code pointing to the register page
  useEffect(() => {
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/register`
      : `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/register`;

    QRCode.toDataURL(url, {
      width: 160,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(console.error);
  }, []);

  // Doctor name is fixed

  const isDark = mounted && theme === 'dark';

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-background/80 backdrop-blur-lg shadow-sm' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Image src={LOGO_BASE64} alt="logo" width={40} height={40} className="w-10 h-10 rounded-xl object-cover" unoptimized />
              <span className="font-bold text-xl hidden sm:block">{doctorName}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {mounted && (
                <button
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                  className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  title="Toggle theme"
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              )}
              <Link href="/auth/login">
                <Button variant="ghost" size="sm" className="hidden sm:flex">
                  <LogIn className="w-4 h-4 mr-2" />
                  {t('login')}
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm" className="bg-gradient-to-r from-primary to-purple-600">
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t('getStarted')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5" />
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-1/2 -right-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl"
          />
          <motion.div
            animate={{ scale: [1.2, 1, 1.2], rotate: [90, 0, 90] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            className="absolute -bottom-1/2 -left-1/2 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-3xl"
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Star className="w-4 h-4" />
                Educational Management System
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
            >
              <span className="bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent">
                {doctorName}
              </span>
              <br />
              <span className="text-foreground">Educational System</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
            >
              A comprehensive platform for students to access course materials,
              track attendance, take quizzes, and engage with interactive learning experiences.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/auth/register">
                <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 text-lg px-8">
                  <UserPlus className="w-5 h-5 mr-2" />
                  {t('createAccount')}
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  <LogIn className="w-5 h-5 mr-2" />
                  {t('login')}
                </Button>
              </Link>
            </motion.div>

            {/* Real QR Code */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-16"
            >
              <Card className="inline-block bg-card/50 backdrop-blur-sm border-dashed">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Link href="/auth/register" className="block">
                      <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center overflow-hidden p-1 hover:scale-105 transition-transform cursor-pointer">
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="Scan to register" className="w-full h-full" />
                        ) : (
                          <QrCode className="w-16 h-16 text-primary" />
                        )}
                      </div>
                    </Link>
                    <div className="text-left">
                      <h3 className="font-semibold text-lg">{t('scanToAccess')}</h3>
                      <p className="text-muted-foreground text-sm">
                        {t('scanHint')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-primary/30 flex items-start justify-center p-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Section with animated counters */}
      <section className="py-20 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  <AnimatedCounter
                    target={stat.target}
                    suffix={stat.suffix}
                    divisor={stat.divisor}
                  />
                </div>
                <div className="text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Succeed
              </span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our platform provides all the tools and resources you need for academic success
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full card-hover">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Start Your Journey?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
              Join thousands of students already using our platform to enhance their learning experience
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/register">
                <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90">
                  <Users className="w-5 h-5 mr-2" />
                  Register Now
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" onClick={handleInstall}>
                <Download className="w-5 h-5 mr-2" />
                Download App
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image src={LOGO_BASE64} alt="logo" width={32} height={32} className="w-8 h-8 rounded-lg object-cover" unoptimized />
              <span className="font-semibold">{doctorName} Educational System</span>
            </div>
            <div className="text-muted-foreground text-xs flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1 flex-wrap justify-center">
                <span>© {new Date().getFullYear()} All rights reserved. Designed by</span>
                <a
                  href="https://www.facebook.com/kerlos.foudi?mibextid=ZbWKwL"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-indigo-500 hover:text-indigo-400 transition-colors underline underline-offset-2"
                >
                  ENG: KERLOS FOUAD
                </a>
              </div>
              <div className="text-xs text-indigo-400">
                Assistants: <span className="font-semibold">Eng/Hedra Victor</span> &amp; <span className="font-semibold">Eng/Mina Fouad</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Login</Link>
              <Link href="/auth/register" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Register</Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Support</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
