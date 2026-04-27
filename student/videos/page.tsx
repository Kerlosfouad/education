'use client';

import { useEffect, useState } from 'react';
import { Video, Play, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';

interface VideoItem {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  uploadedAt: string;
  subject: { name: string } | null;
}

export default function StudentVideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    fetch('/api/videos')
      .then(r => r.json())
      .then(json => { if (json.success) setVideos(json.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <AnnouncementBanner page="videos" />      <div>
        <h2 className="text-3xl font-black text-slate-800">{t('videos')}</h2>
        <p className="text-slate-500 mt-1">{t('allLectureVideos')}</p>
      </div>

      {videos.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm text-center py-20">
          <Video size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400">{t('noVideosAvailable')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map(v => (
            <div key={v.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all group">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 h-40 flex items-center justify-center relative">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="text-white" size={28} fill="white" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-slate-800 mb-1 line-clamp-1">{v.title}</h3>
                {v.description && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{v.description}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{v.subject?.name || t('general')}</span>
                  <a href={v.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-xl hover:bg-blue-200 transition-colors">
                    <Play size={12} /> {t('watch')}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
