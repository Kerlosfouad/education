'use client';

import { useState } from 'react';
import { 
  Video, 
  Plus, 
  Copy, 
  Check, 
  ExternalLink, 
  Users, 
  Clock, 
  Share2 
} from 'lucide-react';

export default function LecturesPage() {
  const [copied, setCopied] = useState(false);
  const meetingLink = "https://meet.google.com/abc-defg-hij"; // static example link

  const copyToClipboard = () => {
    navigator.clipboard.writeText(meetingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Live Lectures</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Start a meeting and share the invitation with your students.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Start Meeting Card */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#0f1f38] p-10 rounded-3xl border border-slate-100 dark:border-[#1a2f4a] shadow-sm flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 shadow-inner">
              <Video size={40} strokeWidth={1.5} />
            </div>
            
            <div className="max-w-md">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Start Your Lecture</h3>
              <p className="text-slate-400 mt-2 text-sm">Launch a Google Meet session instantly. Ensure your camera and microphone are ready.</p>
            </div>

            <div className="flex flex-col w-full gap-4 max-w-sm">
              <a 
                href="https://meet.google.com/new" 
                target="_blank" 
                className="flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
              >
                <Plus size={20} />
                Start New Meeting
              </a>

              <div className="p-2 bg-slate-50 dark:bg-[#0a1628] rounded-2xl border border-slate-100 dark:border-[#1a2f4a] flex items-center gap-2 overflow-hidden">
                <div className="flex-1 px-3 text-xs font-mono text-slate-500 truncate">
                  {meetingLink}
                </div>
                <button 
                  onClick={copyToClipboard}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    copied ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-[#0d1e35] text-indigo-600 border border-slate-200 dark:border-[#1a2f4a] hover:bg-indigo-50'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Info Card */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 dark:from-[#00c896] dark:to-[#00a87e] p-8 rounded-3xl text-white shadow-xl shadow-indigo-100 dark:shadow-none relative overflow-hidden">
            <Share2 className="absolute -bottom-4 -right-4 opacity-10" size={120} />
            <h4 className="text-lg font-bold mb-4">Sharing Instructions</h4>
            <ul className="space-y-4">
              <li className="flex gap-3 text-sm opacity-90 leading-relaxed">
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center shrink-0">1</div>
                Click "Start New Meeting" to open Google Meet.
              </li>
              <li className="flex gap-3 text-sm opacity-90 leading-relaxed">
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center shrink-0">2</div>
                Copy the meeting link from the input field.
              </li>
              <li className="flex gap-3 text-sm opacity-90 leading-relaxed">
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center shrink-0">3</div>
                Share it with your students via Email or WhatsApp.
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}