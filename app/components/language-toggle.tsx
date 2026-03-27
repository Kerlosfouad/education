'use client';

import { Languages } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export function LanguageToggle() {
  const { lang, toggleLang } = useI18n();

  return (
    <button
      onClick={toggleLang}
      className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      title={lang === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
      aria-label="Toggle language"
      type="button"
    >
      <span className="flex items-center gap-2">
        <Languages className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-semibold">{lang === 'en' ? 'AR' : 'EN'}</span>
      </span>
    </button>
  );
}

