'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ── Bottom banner (auto-shows after 3s) ──────────────────────────────────────
export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const dismissed = sessionStorage.getItem('pwa-banner-dismissed');

    if (ios) {
      if (!dismissed) setTimeout(() => setShowBanner(true), 4000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!dismissed) setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) { setShowIOSGuide(true); return; }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') { setIsInstalled(true); setShowBanner(false); }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa-banner-dismissed', '1');
  };

  if (isInstalled) return null;
  if (!showBanner) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 z-[100] md:left-auto md:right-6 md:w-80 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
            <Smartphone size={24} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Install App</p>
            <p className="text-xs text-slate-400 truncate">Add to home screen for quick access</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleInstall}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors">
              Install
            </button>
            <button onClick={handleDismiss}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* iOS guide modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowIOSGuide(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 mb-2" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg text-center mb-4">Install on iPhone / iPad</h3>
            <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-5">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                Tap the <strong>Share</strong> button (□↑) at the bottom of Safari
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                Scroll down and tap <strong>"Add to Home Screen"</strong>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                Tap <strong>"Add"</strong> to confirm
              </li>
            </ol>
            <button onClick={() => { setShowIOSGuide(false); setShowBanner(false); sessionStorage.setItem('pwa-banner-dismissed', '1'); }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors text-sm">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Navbar button ─────────────────────────────────────────────────────────────
export function InstallPWAButton({ className }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) { setIsInstalled(true); return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setDeferredPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isInstalled) return null;

  const handleInstall = async () => {
    if (isIOS) { setShowIOSGuide(true); return; }
    if (deferredPrompt) {
      // Native Android prompt
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    } else {
      // Fallback: show manual guide
      setShowAndroidGuide(true);
    }
  };

  return (
    <>
      <button onClick={handleInstall} title="Install App"
        className={className || 'p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors'}>
        <Download size={20} />
      </button>

      {/* Android manual guide */}
      {showAndroidGuide && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowAndroidGuide(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 mb-2" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Download size={28} className="text-indigo-600" />
            </div>
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg text-center mb-1">Install the App</h3>
            <p className="text-xs text-slate-400 text-center mb-5">Open this page on your phone to install</p>

            <div className="space-y-3 mb-5">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4">
                <p className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-2">🤖 Android (Chrome)</p>
                <ol className="space-y-1 text-xs text-slate-500 dark:text-slate-400 list-decimal list-inside">
                  <li>Open this website in Chrome on your phone</li>
                  <li>Tap the 3-dot menu (⋮) → "Add to Home screen"</li>
                  <li>Tap "Add" — the app opens standalone, no browser bar</li>
                </ol>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4">
                <p className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-2">🍎 iPhone / iPad (Safari)</p>
                <ol className="space-y-1 text-xs text-slate-500 dark:text-slate-400 list-decimal list-inside">
                  <li>Open this website in Safari on your iPhone</li>
                  <li>Tap the Share button (□↑) at the bottom</li>
                  <li>Tap "Add to Home Screen" → "Add"</li>
                </ol>
              </div>
            </div>

            <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 mb-4">
              📱 After installing, the app opens fullscreen with no browser bar
            </p>

            <button onClick={() => setShowAndroidGuide(false)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors text-sm">
              Got it
            </button>
          </div>
        </div>
      )}

      {/* iOS guide modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowIOSGuide(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 mb-2" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg text-center mb-4">Install on iPhone / iPad</h3>
            <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-5">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                Tap the <strong>Share</strong> button (□↑) at the bottom of Safari
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                Scroll down and tap <strong>"Add to Home Screen"</strong>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                Tap <strong>"Add"</strong> to confirm
              </li>
            </ol>
            <button onClick={() => setShowIOSGuide(false)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors text-sm">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
