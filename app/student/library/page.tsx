'use client';

import { useEffect, useState } from 'react';
import { Library, FileText, File, ExternalLink, Loader2, Download } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface LibraryItem {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  category: string;
  fileUrl: string | null;
  externalUrl: string | null;
  subject: { name: string } | null;
}

export default function StudentLibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/student/library')
      .then(r => r.json())
      .then(json => { if (json.success) setItems(json.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(i =>
    i.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black text-slate-800">{t('eLibrary')}</h2>
        <p className="text-slate-500 mt-1">{t('booksReferences')}</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder={t('searchBook')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-4 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm text-center py-20">
          <Library size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400">{t('noLibraryFiles')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(item => {
            const isPdf = item.category === 'PDF';
            return (
              <div key={item.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-50' : 'bg-blue-50'}`}>
                    {isPdf
                      ? <FileText className="text-red-500" size={22} />
                      : <File className="text-blue-500" size={22} />
                    }
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 text-sm truncate">{item.title}</h3>
                    <span className={`text-[10px] font-bold uppercase ${isPdf ? 'text-red-400' : 'text-blue-400'}`}>
                      {item.category}
                    </span>
                  </div>
                </div>
                {(item.fileUrl || item.externalUrl) && (
                  <a href={item.fileUrl || item.externalUrl || '#'} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 p-2.5 bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 rounded-xl transition-colors">
                    <Download size={16} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
