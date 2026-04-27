'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Settings, Camera, Lock, Phone, Save, Loader2, Eye, EyeOff,
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useUploadThing } from '@/lib/uploadthing';

interface DoctorSettings {
  name: string; email: string; image: string;
  title: string; bio: string; phone: string;
  whatsapp: string; facebook: string; instagram: string; twitter: string;
}

export default function SettingsPage() {
  const { data: _session } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<DoctorSettings>({
    name: '', email: '', image: '', title: '', bio: '',
    phone: '', whatsapp: '', facebook: '', instagram: '', twitter: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  const { startUpload, isUploading } = useUploadThing('imageUploader', {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.url;
      if (url) {
        setForm(prev => ({ ...prev, image: url }));
        setImagePreview(url);
        toast.success('Image uploaded');
      }
    },
    onUploadError: (err) => { toast.error(`Upload failed: ${err.message}`); },
  });

  useEffect(() => {
    fetch('/api/doctor/settings')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setForm(json.data);
          setImagePreview(json.data.image || '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local preview while uploading
    setImagePreview(URL.createObjectURL(file));
    await startUpload([file]);
  };

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/doctor/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ...(newPassword ? { currentPassword, newPassword } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Settings saved successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  const initials = form.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'DR';

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-indigo-600" size={40} />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Settings className="text-indigo-600" size={28} />
        <div>
          <h2 className="text-3xl font-black text-slate-800">Settings</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage your profile and account settings</p>
        </div>
      </div>

      {/* Profile Photo + Name */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2">
          <Camera size={18} className="text-indigo-500" /> Profile
        </h3>

        <div className="flex items-center gap-6 mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-2xl overflow-hidden">
              {imagePreview
                ? <Image src={imagePreview} alt="avatar" width={96} height={96} className="object-cover w-full h-full" unoptimized />
                : initials}
              {isUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
                  <Loader2 size={24} className="animate-spin text-white" />
                </div>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={isUploading}
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
              <Camera size={14} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
          <div>
            <p className="font-bold text-slate-800">{form.name || 'Dr. Emad'}</p>
            <p className="text-sm text-slate-400">{form.email}</p>
            <button onClick={() => fileRef.current?.click()} disabled={isUploading}
              className="mt-2 text-xs text-indigo-600 hover:underline font-medium disabled:opacity-50">
              {isUploading ? 'Uploading...' : 'Change photo'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Full Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Title</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Professor of Computer Science"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Bio</label>
            <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
              rows={3} placeholder="Write a short bio..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 resize-none" />
          </div>
        </div>
      </div>

      {/* Contact & Social */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2">
          <Phone size={18} className="text-indigo-500" /> Contact & Social Media
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'phone', label: 'Phone Number', placeholder: '+20 1xx xxx xxxx', emoji: '📞' },
            { key: 'whatsapp', label: 'WhatsApp', placeholder: '+20 1xx xxx xxxx', emoji: '💬' },
            { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/yourpage', emoji: '📘' },
            { key: 'instagram', label: 'Instagram', placeholder: '@yourhandle', emoji: '📸' },
            { key: 'twitter', label: 'X (Twitter)', placeholder: '@yourhandle', emoji: '🐦' },
          ].map(({ key, label, placeholder, emoji }) => (
            <div key={key}>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">{emoji} {label}</label>
              <input
                value={(form as any)[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2">
          <Lock size={18} className="text-indigo-500" /> Change Password
        </h3>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Current Password</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50" />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">New Password</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50" />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Confirm New Password</label>
            <input type="password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50" />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pb-8">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
