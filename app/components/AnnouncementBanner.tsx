'use client';

import { useState, useEffect } from 'react';

export function AnnouncementBanner({ page }: { page: string }) {
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/student/announcements?page=${page}`)
      .then(r => r.json())
      .then(j => { if (j.success) setAnnouncements(j.data); });
  }, [page]);

  if (!announcements.length) return null;

  return (
    <div className="space-y-3 mb-6">
      {announcements.map((a: any) => (
        <div key={a.id} className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl overflow-hidden">
          {a.imageUrl && <img src={a.imageUrl} alt="" className="w-full h-40 object-cover" />}
          <div className="p-4 flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">📢</span>
            <div>
              <p className="font-black text-slate-800 dark:text-slate-100">{a.title}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{a.message}</p>
              <p className="text-xs text-slate-400 mt-1">{new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
