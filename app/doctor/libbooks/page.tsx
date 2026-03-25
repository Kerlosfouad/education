'use client';

import { useState, useEffect } from 'react';
import { UploadCloud, FileText, File, Trash2, Download, Search } from 'lucide-react';
import { UploadButton } from "@uploadthing/react";

// Import actions - verify path
import { saveBookAction, getBooksAction, deleteBookAction } from "../../actions/bookActions";
import type { OurFileRouter } from "../../api/uploadthing/core";

export default function LibBooksPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { refreshBooks(); }, []);

  const refreshBooks = async () => {
    const data = await getBooksAction();
    if (data) setFiles(data);
  };

  // دالة الحذف
  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this book?")) {
      const res = await deleteBookAction(id);
      if (res.success) {
        alert("Deleted successfully!");
        refreshBooks(); // تحديث القائمة بعد الحذف
      } else {
        alert("Delete failed.");
      }
    }
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
      <header>
        <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase">E-Library Resources</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Manage and delete your academic materials.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Upload Card */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#0f1f38] p-8 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-[#1a2f4a] hover:border-indigo-400 transition-all flex flex-col items-center text-center shadow-sm">
            <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 mb-6">
              <UploadCloud size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">New Upload</h3>
            <div className="w-full mt-8 [&_input[type=file]]:hidden [&_.ut-label]:hidden">
              <UploadButton<OurFileRouter>
                endpoint="pdfUploader"
                onClientUploadComplete={async (res) => {
                  if (res) {
                    await saveBookAction({
                      name: res[0].name,
                      type: res[0].name.endsWith('.pdf') ? 'PDF' : 'WORD',
                      size: (res[0].size / (1024 * 1024)).toFixed(1) + " MB",
                      url: res[0].url
                    });
                    refreshBooks();
                  }
                }}
                appearance={{
                  button: "w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-100 dark:shadow-none",
                  container: "w-full",
                  allowedContent: "text-slate-400 dark:text-slate-500 text-xs mt-2"
                }}
              />
            </div>
          </div>
        </div>

        {/* Files List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#0f1f38] p-5 rounded-3xl border border-slate-100 dark:border-[#1a2f4a] flex items-center gap-4 shadow-sm">
            <Search className="text-slate-300" size={22} />
            <input 
              type="text" 
              placeholder="Search books..." 
              className="bg-transparent border-none outline-none text-sm w-full font-medium dark:text-white dark:placeholder:text-slate-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredFiles.map((file) => (
              <div key={file.id} className="bg-white dark:bg-[#0f1f38] p-5 rounded-[2rem] border border-slate-100 dark:border-[#1a2f4a] hover:shadow-xl transition-all flex items-center justify-between group shadow-sm">
                <div className="flex items-center gap-5 truncate">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    file.type === 'PDF' ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'
                  }`}>
                    {file.type === 'PDF' ? <FileText size={28} /> : <File size={28} />}
                  </div>
                  <div className="truncate text-right">
                    <h4 className="font-bold text-slate-700 dark:text-white text-[15px] truncate max-w-[200px] md:max-w-md">{file.name}</h4>
                    <p className="text-[11px] text-slate-400 font-bold uppercase">{file.type} • {file.size}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <a href={file.url} target="_blank" className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-2xl transition-all">
                    <Download size={22} />
                  </a>
                  <button 
                    onClick={() => handleDelete(file.id)}
                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"
                  >
                    <Trash2 size={22} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}