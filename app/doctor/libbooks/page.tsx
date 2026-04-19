'use client';

import { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileText, File, Trash2, Download, Search, Plus, X } from 'lucide-react';
import { useUploadThing } from '@/lib/uploadthing';
import { saveBookAction, getBooksAction, deleteBookAction } from '../../actions/bookActions';
import { toast } from 'sonner';

export default function LibBooksPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', departmentId: '', academicYear: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedDept = departments.find(d => d.id === form.departmentId);
  const LEVELS = selectedDept?.code === 'PREP' ? [0, 1] : [0, 1, 2, 3, 4];

  const { startUpload } = useUploadThing('pdfUploader');

  useEffect(() => {
    refreshBooks();
    fetch('/api/subjects/departments').then(r => r.json()).then(j => { if (j.success) setDepartments(j.data); });
  }, []);

  const refreshBooks = async () => {
    const data = await getBooksAction();
    if (data) setFiles(data);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure?')) {
      const res = await deleteBookAction(id);
      if (res.success) refreshBooks(); else alert('Delete failed.');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) { toast.error('Please select a PDF file'); return; }
    setUploading(true);
    try {
      const uploaded = await startUpload([selectedFile]);
      if (!uploaded?.[0]) { toast.error('Upload failed'); return; }
      await saveBookAction({
        name: form.title || selectedFile.name,
        type: selectedFile.name.endsWith('.pdf') ? 'PDF' : 'FILE',
        size: (selectedFile.size / (1024 * 1024)).toFixed(1) + ' MB',
        url: uploaded[0].url,
        ...(form.departmentId ? { departmentId: form.departmentId } : {}),
        ...(form.academicYear ? { academicYear: Number(form.academicYear) } : {}),
      });
      toast.success('File uploaded successfully');
      setShowModal(false);
      setForm({ title: '', description: '', departmentId: '', academicYear: '' });
      setSelectedFile(null);
      refreshBooks();
    } catch { toast.error('Upload failed'); }
    setUploading(false);
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className='space-y-8 p-4 md:p-8'>
      <header className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-black text-slate-800 dark:text-white uppercase'>E-Library Resources</h2>
          <p className='text-slate-500 dark:text-slate-400 mt-1'>Manage your academic materials.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className='flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100'>
          <Plus size={18} /> Upload PDF
        </button>
      </header>

      {/* Search + Files */}
      <div className='space-y-4'>
        <div className='bg-white dark:bg-[#0f1f38] p-5 rounded-3xl border border-slate-100 dark:border-[#1a2f4a] flex items-center gap-4 shadow-sm'>
          <Search className='text-slate-300' size={22} />
          <input type='text' placeholder='Search books...' className='bg-transparent border-none outline-none text-sm w-full dark:text-white' value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className='grid grid-cols-1 gap-4'>
          {filteredFiles.map(file => (
            <div key={file.id} className='bg-white dark:bg-[#0f1f38] p-5 rounded-[2rem] border border-slate-100 dark:border-[#1a2f4a] hover:shadow-xl transition-all flex items-center justify-between shadow-sm'>
              <div className='flex items-center gap-5 truncate'>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${file.type === 'PDF' ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'}`}>
                  {file.type === 'PDF' ? <FileText size={28} /> : <File size={28} />}
                </div>
                <div className='truncate'>
                  <h4 className='font-bold text-slate-700 dark:text-white text-[15px] truncate max-w-[200px] md:max-w-md'>{file.name}</h4>
                  <p className='text-[11px] text-slate-400 font-bold uppercase'>
                    {file.type} • {file.size}
                    {file.department && <span className='ml-2 text-indigo-400'>{file.department.name}</span>}
                    {file.academicYear && <span className='ml-1 text-indigo-400'>· Level {file.academicYear}</span>}
                  </p>
                </div>
              </div>
              <div className='flex items-center gap-3'>
                <a href={file.url} target='_blank' rel='noopener noreferrer' className='p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all'><Download size={22} /></a>
                <button onClick={() => handleDelete(file.id)} className='p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all'><Trash2 size={22} /></button>
              </div>
            </div>
          ))}
          {filteredFiles.length === 0 && (
            <div className='text-center py-16 text-slate-400'>
              <UploadCloud size={48} className='mx-auto mb-3 opacity-30' />
              <p className='font-medium'>No files yet. Click "Upload PDF" to add one.</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className='fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4'>
          <div className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4'>
            <div className='flex items-center justify-between'>
              <h3 className='font-black text-slate-800 dark:text-slate-100 text-lg'>Upload PDF</h3>
              <button onClick={() => setShowModal(false)} className='w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 flex items-center justify-center'>
                <X size={16} />
              </button>
            </div>

            <div className='space-y-3'>
              <div>
                <label className='text-xs font-bold text-slate-500 uppercase mb-1.5 block'>Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder='e.g. Chapter 1 - Introduction'
                  className='w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100' />
              </div>
              <div>
                <label className='text-xs font-bold text-slate-500 uppercase mb-1.5 block'>Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder='Optional description...' rows={2}
                  className='w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 resize-none' />
              </div>
              <div>
                <label className='text-xs font-bold text-slate-500 uppercase mb-1.5 block'>Department</label>
                <select value={form.departmentId} onChange={e => setForm(p => ({ ...p, departmentId: e.target.value, academicYear: '' }))}
                  className='w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'>
                  <option value=''>All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className='text-xs font-bold text-slate-500 uppercase mb-1.5 block'>Level</label>
                <select value={form.academicYear} onChange={e => setForm(p => ({ ...p, academicYear: e.target.value }))}
                  className='w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'>
                  <option value=''>All Levels</option>
                  {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
                </select>
              </div>
              <div>
                <label className='text-xs font-bold text-slate-500 uppercase mb-1.5 block'>PDF File *</label>
                <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${selectedFile ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'}`}>
                  <input ref={fileRef} type='file' accept='.pdf,.doc,.docx' className='hidden'
                    onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
                  {selectedFile ? (
                    <div className='text-center'>
                      <FileText className='w-6 h-6 text-indigo-500 mx-auto mb-1' />
                      <p className='text-sm font-medium text-indigo-600'>{selectedFile.name}</p>
                      <p className='text-xs text-slate-400'>{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                    </div>
                  ) : (
                    <div className='text-center'>
                      <UploadCloud className='w-6 h-6 text-slate-300 mx-auto mb-1' />
                      <p className='text-sm text-slate-400'>Click to select PDF</p>
                      <p className='text-xs text-slate-300'>PDF, DOC, DOCX</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <button onClick={handleUpload} disabled={uploading || !selectedFile}
              className='w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50'>
              <UploadCloud size={18} />
              {uploading ? 'Uploading...' : 'Upload PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
