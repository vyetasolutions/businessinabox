import React, { useEffect, useState } from 'react';
import { Upload, Search, FileText, Download, Trash2, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useDocumentUpload } from '../lib/useDocumentUpload';
import { planAllows } from '../lib/plans';
import FeaturePreview from '../components/FeaturePreview';

const CATEGORY_OPTIONS = [
  { value: 'contract', label: 'Contract' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' }
];

export default function DocumentVault() {
  const { organization } = useAuth();
  const { uploadAndProcess, getSignedFileUrl, discardUpload, uploading } = useDocumentUpload();

  const [category, setCategory] = useState('contract');
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState('');

  const enabled = planAllows(organization, 'ocr_scanning');

  const load = async () => {
    setLoading(true);
    let req = supabase.from('document_uploads').select('*').eq('pipeline', 'vault').order('created_at', { ascending: false });
    if (query.trim()) req = req.textSearch('extracted_text', query.trim(), { type: 'plain' });
    const { data, error } = await req;
    if (!error) setDocuments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (enabled) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!enabled) {
    return (
      <FeaturePreview
        feature="Document vault"
        requiredPlan="business_plus"
        mockup={
          <div className="max-w-2xl mx-auto glass-panel rounded-2xl divide-y divide-slate-200 dark:divide-white/10">
            {['Shop Lease Agreement 2026', 'Fire Safety Certificate', 'Supplier Contract — ACME Wholesale'].map((t) => (
              <div key={t} className="p-4 flex items-center gap-3">
                <FileText className="w-4 h-4 text-gold-500" />
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{t}</span>
              </div>
            ))}
          </div>
        }
      />
    );
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const result = await uploadAndProcess(file, category, 'vault', title || file.name);
    e.target.value = '';
    setTitle('');
    if (!result.success) {
      setError(result.error);
      return;
    }
    await load();
  };

  const openDocument = async (doc) => {
    const url = await getSignedFileUrl(doc.file_path);
    setViewing({ ...doc, signedUrl: url });
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    await discardUpload(doc);
    setViewing(null);
    await load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <h4 className="section-eyebrow">Add to Document Vault</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Contracts and certificates are stored and made text-searchable. Digital PDFs and Word docs are read directly — no OCR
          needed unless it's a scanned image.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Title (optional)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Shop Lease 2026" className="input-field" />
          </div>
        </div>
        <label className="border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gold-500/50 transition-colors">
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
              <span className="text-sm text-slate-500 dark:text-slate-400">Processing…</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-slate-400" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Upload a PDF, Word doc, or photo</span>
            </>
          )}
          <input
            type="file"
            accept="image/*,application/pdf,.doc,.docx"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
        {error && <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your documents…" className="input-field !pl-9" />
      </div>

      <div className="glass-panel rounded-2xl divide-y divide-slate-200 dark:divide-white/10">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">No documents saved yet.</p>
        ) : (
          documents.map((doc) => (
            <button key={doc.id} onClick={() => openDocument(doc)} className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/5 text-left">
              <FileText className="w-4 h-4 text-gold-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{doc.title}</p>
                <p className="text-[11px] text-slate-400 capitalize">{doc.category} · {new Date(doc.created_at).toLocaleDateString()}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {viewing && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 rounded-3xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{viewing.title}</h3>
                <p className="text-xs text-slate-400 capitalize">{viewing.category}</p>
              </div>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-rose-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2">
              {viewing.signedUrl && (
                <a href={viewing.signedUrl} target="_blank" rel="noreferrer" className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                  <Download className="w-4 h-4" /> Open Original
                </a>
              )}
              <button onClick={() => handleDelete(viewing)} className="btn-ghost px-4 py-2.5 rounded-xl text-sm font-bold text-rose-500 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
            <div>
              <label className="label-field">Extracted Text</label>
              <div className="bg-slate-100 dark:bg-white/5 rounded-xl p-4 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {viewing.extracted_text || 'No text extracted.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
