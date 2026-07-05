import React from 'react';
import { BadgeCheck, ExternalLink, MessageSquare, WifiOff } from 'lucide-react';

export default function SuccessModal({ result, onClose }) {
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-6 rounded-3xl shadow-2xl space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <BadgeCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Document Ready!</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {result.isOfflineSave
              ? 'Saved on this device. It will sync automatically once you are back online.'
              : 'Your document has been created and saved.'}
          </p>
          {result.isOfflineSave && (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full">
              <WifiOff className="w-3 h-3" /> Offline — queued for sync
            </div>
          )}
        </div>

        <div className="space-y-2">
          <a
            href={result.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-gold w-full py-3.5 rounded-xl flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> View PDF
          </a>
          <a
            href={result.whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="w-full bg-[#25D366] hover:bg-[#22c35e] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <MessageSquare className="w-4 h-4" /> Share on WhatsApp
          </a>
          <button onClick={onClose} className="btn-ghost w-full py-3 rounded-xl font-bold text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
