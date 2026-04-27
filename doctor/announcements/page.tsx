'use client';

import { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Loader2, X, Check, Image as ImageIcon, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useUploadThing } from '@/lib/uploadthing';

interface Announcement {
  id: string; title: string; message: string;
  imageUrl: string | null; departmentId: string | null;
  academicYear: number | null; createdAt: string;
  targetPage: string | null;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', departmentId: '', academicYear: '', imageUrl: '', targetPage: '' });

  const PAGES = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'assignments', label: 'Assignments' },
    { value: 'quizzes', label: 'Quizzes' },
    { value: 'videos', label: 'Videos' },
    { value: 'library', label: 'E-Library' },
    { value: 'live', label: 'Live Sessions' },
  ];

  const LEVELS_BY_DEPT = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    if (!deptId) return [0,1,2,3,4].map(l => ({ value: String(l), label: `Level ${l}` }));
    if (dept?.code === 'PREP') return [{ value: '0', label: 'Level 0' }];
    return [1,2,3,4].map(l => ({ value: String(l), label: `Level ${l}` }));
  };
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  const { startUpload, isUploading } = useUploadThing('imageUploader', {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.url;
      if (url) { setForm(p => ({ ...p, imageUrl: url })); setImagePreview(url); }
    },
  });

  const load = async () => {
    const [annRes, deptRes] = await Promise.all([
      fetch('/api/doctor/announcements'),
      fetch('/api/subjects/departments'),
    ]);
    const [annJson, deptJson] = await Promise.all([annRes.json(), deptRes.json()]);
    if (annJson.success) setAnnouncements(annJson.data);
    if (deptJson.success) setDepartments(deptJson.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    await startUpload([file]);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({ title: a.title, message: a.message, departmentId: a.departmentId || '', academicYear: a.academicYear ? String(a.academicYear) : '', imageUrl: a.imageUrl || '', targetPage: a.targetPage || '' });
    setImagePreview(a.imageUrl || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.message) { toast.error('Title and message are required'); return; }
    setSaving(true);
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch('/api/doctor/announcements', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          ...form,
          academicYear: form.academicYear ? Number(form.academicYear) : null,
          departmentId: form.departmentId || null,
          targetPage: form.targetPage || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(editingId ? 'Announcement updated' : 'Announcement published');
      setShowForm(false);
      setEditingId(null);
      setForm({ title: '', message: '', departmentId: '', academicYear: '', imageUrl: '', targetPage: '' });
      setImagePreview('');
      load();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    await fetch('/api/doctor/announcements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    toast.success('Deleted');
    load();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Megaphone className="text-indigo-600" size={28} />
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">Announcements</h2>
            <p className="text-slate-500 text-sm mt-0.5">Post announcements to students by department and level</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 self-start sm:self-auto">
          <Plus size={18} /> New Announcement
        </button>
      </div>

      {/* List */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Megaphone size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No announcements yet</p>
          </div>
        ) : announcements.map(a => (
          <div key={a.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            {a.imageUrl && <img src={a.imageUrl} alt="" className="w-full h-48 object-cover" />}
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{a.title}</h3>
                  <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm leading-relaxed">{a.message}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {a.departmentId && departments.find(d => d.id === a.departmentId) && (
                      <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                        {departments.find(d => d.id === a.departmentId)?.name}
                      </span>
                    )}
                    {a.academicYear !== null && a.academicYear !== undefined && (
                      <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">
                        Level {a.academicYear}
                      </span>
                    )}
                    {!a.departmentId && !a.academicYear && (
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-bold">All Students</span>
                    )}
                    {a.targetPage && (
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold capitalize">📍 {a.targetPage}</span>
                    )}
                    <span className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(a)}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 hover:text-indigo-600 flex items-center justify-center transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(a.id)}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">{editingId ? 'Edit Announcement' : 'New Announcement'}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Important Notice"
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Message *</label>
                <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Write your announcement here..." rows={4}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 resize-none" />
              </div>

              {/* Image upload */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Image (optional)</label>
                <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${imagePreview ? 'border-indigo-400' : 'border-slate-200 hover:border-indigo-300'}`}>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                      <p className="text-sm text-slate-400">{isUploading ? 'Uploading...' : 'Click to add image'}</p>
                    </div>
                  )}
                </label>
                {imagePreview && (
                  <button onClick={() => { setImagePreview(''); setForm(p => ({ ...p, imageUrl: '' })); }}
                    className="mt-1 text-xs text-red-500 hover:underline">Remove image</button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Department</label>
                  <select value={form.departmentId} onChange={e => { setForm(p => ({ ...p, departmentId: e.target.value, academicYear: '' })); }}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Level</label>
                  <select value={form.academicYear} onChange={e => setForm(p => ({ ...p, academicYear: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                    <option value="">All Levels</option>
                    {LEVELS_BY_DEPT(form.departmentId).map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Show on Page</label>
                <select value={form.targetPage} onChange={e => setForm(p => ({ ...p, targetPage: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  <option value="">All Pages (Dashboard)</option>
                  {PAGES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowForm(false); setEditingId(null); }}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || isUploading}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Saving...' : editingId ? 'Update' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
