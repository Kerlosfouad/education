'use client';

export const dynamic = 'force-dynamic';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-8 bg-slate-900">
      <div className="text-7xl mb-6">📚</div>
      <h1 className="text-2xl font-black text-white mb-2">You're offline</h1>
      <p className="text-slate-400 mb-8 max-w-xs">
        Content you've visited before is still available. Connect to the internet to access new content.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
