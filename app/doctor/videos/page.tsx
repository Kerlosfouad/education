'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Video, Trash2, Search, X, Play, FileVideo } from 'lucide-react';
import { useUploadThing } from '@/lib/uploadthing';
import { useI18n } from '@/lib/i18n';

type VideoItem = {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;
  subject: { name: string } | null;
};

type Subject = { id: string; name: string };
type Department = { id: string; name: string; code: string; nameAr: string | null };

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);

  const [form, setForm] = useState({ title: '', description: '', departmentId: '', academicYear: '', subjectId: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const { t } = useI18n();

  const { startUpload } = useUploadThing('videoUploader', {
    onUploadProgress: (p) => setUploadProgress(p),
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/videos').then(r => r.json()),
      fetch('/api/subjects/departments').then(r => r.json()),
    ]).then(([vData, dData]) => {
      setVideos(Array.isArray(vData.data) ? vData.data : []);
      setDepartments(Array.isArray(dData.data) ? dData.data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Load subjects filtered by department + academic year.
    if (!form.departmentId || !form.academicYear) {
      setSubjects([]);
      setForm(p => ({ ...p, subjectId: '' }));
      return;
    }
    fetch(`/api/subjects?departmentId=${encodeURIComponent(form.departmentId)}&academicYear=${encodeURIComponent(form.academicYear)}`)
      .then(r => r.json())
      .then(json => setSubjects(Array.isArray(json.data) ? json.data : []))
      .catch(() => setSubjects([]));
  }, [form.departmentId, form.academicYear]);

  const handleUpload = async () => {
    setError('');
    if (!form.title || !selectedFile) {
      setError('Please enter a title and select a video file');
      return;
    }
    if (!form.departmentId || !form.academicYear) {
      setError('Please select department and academic year');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await startUpload([selectedFile]);
      if (!uploaded || !uploaded[0]) {
        setError('Upload failed. Try again.');
        return;
      }
      const fileUrl = uploaded[0].url;
      const fileSize = selectedFile.size;

      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description, fileUrl, fileSize }),
      });
      const data = await res.json();
      if (data.success) {
        setVideos(prev => [data.data, ...prev]);
        setShowModal(false);
        setForm({ title: '', description: '', departmentId: '', academicYear: '', subjectId: '' });
        setSelectedFile(null);
        setUploadProgress(0);
      } else {
        setError(data.error || 'Error saving video');
      }
    } catch (err: any) {
      setError(err.message || 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video?')) return;
    await fetch(`/api/videos?id=${id}`, { method: 'DELETE' });
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filtered = videos.filter(v =>
    v.title.toLowerCase().includes(search.toLowerCase()) ||
    v.subject?.name.toLowerCase().includes(search.toLowerCase())
  );

  const academicYearsByDept: Record<string, { value: string; label: string }[]> = {
    PREP: [{ value: '1', label: 'First Year' }],
    default: [
      { value: '2', label: 'Second Year' },
      { value: '3', label: 'Third Year' },
      { value: '4', label: 'Fourth Year' },
      { value: '5', label: 'Fifth Year' },
    ],
  };
  const selectedDept = departments.find(d => d.id === form.departmentId);
  const academicYears = selectedDept?.code === 'PREP'
    ? academicYearsByDept['PREP']
    : academicYearsByDept['default'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{t('videos')}</h1>
          <p className="text-gray-500 mt-1">{t('uploadManageVideos')}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Upload className="w-4 h-4" />
          {t('uploadVideo')}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder={t('searchVideos')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Videos Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileVideo className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t('noVideosUploadFirst')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((video, i) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Thumbnail */}
              <div
                className="relative h-40 bg-gray-900 flex items-center justify-center cursor-pointer group"
                onClick={() => setPlayingVideo(video)}
              >
                <video
                  src={video.fileUrl}
                  className="w-full h-full object-cover opacity-70"
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                    <Play className="w-5 h-5 text-indigo-600 ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 truncate">{video.title}</h3>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-400">
                    {video.subject?.name ?? 'General'} · {formatSize(video.fileSize)}
                  </p>
                  <button
                    onClick={() => handleDelete(video.id)}
                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {video.description && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{video.description}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">Upload Video</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">
                  ⚠️ {error}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Title *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Chapter 1 Introduction"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Optional description..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Department *</label>
                  <select
                    value={form.departmentId}
                    onChange={e => setForm(p => ({ ...p, departmentId: e.target.value, academicYear: '', subjectId: '' }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Academic Year *</label>
                  <select
                    value={form.academicYear}
                    disabled={!form.departmentId}
                    onChange={e => setForm(p => ({ ...p, academicYear: e.target.value, subjectId: '' }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    <option value="">Select year...</option>
                    {academicYears.map(y => (
                      <option key={y.value} value={y.value}>{y.label}</option>
                    ))}
                  </select>
                </div>

                {/* File picker */}
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Video File *</label>
                  <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    selectedFile ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                  }`}>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
                    {selectedFile ? (
                      <div className="text-center">
                        <Video className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
                        <p className="text-sm font-medium text-indigo-600">{selectedFile.name}</p>
                        <p className="text-xs text-gray-400">{formatSize(selectedFile.size)}</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                        <p className="text-sm text-gray-400">Click to select video</p>
                        <p className="text-xs text-gray-300">MP4, MOV, AVI up to 512MB</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Progress */}
                {uploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-indigo-500 rounded-full"
                        animate={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploading ? `Uploading ${uploadProgress}%...` : 'Upload Video'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Player Modal */}
      <AnimatePresence>
        {playingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setPlayingVideo(null); }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-black rounded-2xl overflow-hidden w-full max-w-3xl"
            >
              <div className="flex items-center justify-between p-4 bg-gray-900">
                <p className="text-white font-medium">{playingVideo.title}</p>
                <button onClick={() => setPlayingVideo(null)} className="p-1.5 hover:bg-gray-700 rounded-lg">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <video
                src={playingVideo.fileUrl}
                controls
                autoPlay
                className="w-full max-h-[70vh]"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}