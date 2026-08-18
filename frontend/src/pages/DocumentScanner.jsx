import React, { useEffect, useState } from 'react';
import { Upload, ScanLine, CheckCircle2, XCircle, Loader2, FileWarning, Gauge } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useDocumentUpload } from '../lib/useDocumentUpload';
import { planAllows } from '../lib/plans';
import FeaturePreview from '../components/FeaturePreview';

const CATEGORY_OPTIONS = [
  { value: 'receipt', label: 'Receipt' },
  { value: 'invoice', label: 'Invoice (received)' },
  { value: 'delivery_note', label: 'Delivery Note (received)' }
];

export default function DocumentScanner() {
  const { organization } = useAuth();
  const { uploadAndProcess, discardUpload, uploading, authedFetch } = useDocumentUpload();

  const [category, setCategory] = useState('receipt');
  const [recent, setRecent] = useState([]);
  const [reviewing, setReviewing] = useState(null); // the upload record currently being reviewed
  const [reviewForm, setReviewForm] = useState({ description: '', amount: '', expense_date: '' });
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState(null); // {used, limit, remaining}

  const enabled = planAllows(organization, 'ocr_scanning');

  const loadRecent = async () => {
    const { data } = await supabase
      .from('document_uploads')
      .select('*')
      .eq('pipeline', 'structured')
      .order('created_at', { ascending: false })
      .limit(15);
    setRecent(data || []);
  };

  const loadUsage = async () => {
    try {
      const res = await authedFetch('/api/ocr/usage');
      const data = await res.json();
      if (data.success) setUsage(data);
    } catch {
      // non-critical — the indicator just won't show if this fails
    }
  };

  useEffect(() => {
    if (enabled) {
      loadRecent();
      loadUsage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  if (!enabled) {
    return (
      <FeaturePreview
        feature="Document scanning"
        requiredPlan="business_plus"
        mockup={
          <div className="max-w-xl mx-auto glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-gold-500" />
              <h4 className="section-eyebrow">Scan a Receipt</h4>
            </div>
            <div className="border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl p-10 text-center text-sm text-slate-400">
              Drop a photo of a receipt or invoice here
            </div>
            <div className="flex justify-between text-sm bg-slate-100 dark:bg-white/5 rounded-xl p-4">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Vendor: ACME Wholesale</span>
              <span className="font-bold text-slate-900 dark:text-white">K 360.00</span>
            </div>
          </div>
        }
      />
    );
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const result = await uploadAndProcess(file, category, 'structured');
    e.target.value = '';
    await loadUsage(); // refresh the counter regardless of outcome — even a failed OCR call may have counted
    if (!result.success) {
      setError(result.error);
      return;
    }
    await loadRecent();
    if (result.upload.status === 'needs_review') {
      openReview(result.upload);
    }
  };

  const openReview = (upload) => {
    const fields = upload.extracted_fields || {};
    setReviewing(upload);
    setReviewForm({
      description: fields.vendor || upload.title || '',
      amount: fields.total || '',
      expense_date: normalizeDateGuess(fields.date) || new Date().toISOString().slice(0, 10)
    });
  };

  const normalizeDateGuess = (raw) => {
    if (!raw) return null;
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return null;
  };

  const handleCommit = async (e) => {
    e.preventDefault();
    setCommitting(true);
    try {
      const res = await authedFetch('/api/ocr/commit-expense', {
        method: 'POST',
        body: JSON.stringify({
          uploadId: reviewing.id,
          category: 'Stock Purchase',
          description: reviewForm.description,
          amount: Number(reviewForm.amount),
          expense_date: reviewForm.expense_date
        })
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }
      setReviewing(null);
      await loadRecent();
    } finally {
      setCommitting(false);
    }
  };

  const handleDiscard = async (upload) => {
    await discardUpload(upload);
    setReviewing(null);
    await loadRecent();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-gold-500" />
            <h4 className="section-eyebrow">Scan a Document</h4>
          </div>
          {usage && (
            <span
              className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                usage.remaining <= 20 ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Gauge className="w-3 h-3" /> {usage.used}/{usage.limit} scans this month
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          For receipts and invoices you've <strong>received</strong> (e.g. from a supplier) — extracted details are checked by you
          before anything is saved as an expense.
        </p>
        <div>
          <label className="label-field">Document Type</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <label className="border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gold-500/50 transition-colors">
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 text-gold-500 animate-spin" />
              <span className="text-sm text-slate-500 dark:text-slate-400">Processing…</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-slate-400" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tap to take a photo or choose a file</span>
              <span className="text-[11px] text-slate-400">JPG, PNG, or PDF</span>
            </>
          )}
          <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
        {error && <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}
      </div>

      <div className="glass-panel rounded-2xl divide-y divide-slate-200 dark:divide-white/10">
        <div className="p-4 border-b border-slate-200 dark:border-white/10">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Recent Scans</h4>
        </div>
        {recent.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">No scans yet.</p>
        ) : (
          recent.map((u) => (
            <div key={u.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{u.title}</p>
                <p className="text-[11px] text-slate-400">{new Date(u.created_at).toLocaleString()}</p>
              </div>
              {u.status === 'needs_review' && (
                <button onClick={() => openReview(u)} className="btn-gold px-3 py-1.5 rounded-lg text-xs font-bold shrink-0">
                  Review
                </button>
              )}
              {u.status === 'completed' && (
                <span className="flex items-center gap-1 text-emerald-500 text-xs font-bold shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              {u.status === 'failed' && (
                <span className="flex items-center gap-1 text-rose-500 text-xs font-bold shrink-0">
                  <FileWarning className="w-3.5 h-3.5" /> Failed
                </span>
              )}
              {(u.status === 'queued' || u.status === 'processing') && (
                <span className="flex items-center gap-1 text-amber-500 text-xs font-bold shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {reviewing && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCommit} className="glass-panel max-w-sm w-full p-6 rounded-3xl space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Review Extracted Details</h3>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
              Double-check these — automatic extraction can miss or misread details, especially on handwritten or crumpled receipts.
            </p>
            <div>
              <label className="label-field">Vendor / Description</label>
              <input required value={reviewForm.description} onChange={(e) => setReviewForm({ ...reviewForm, description: e.target.value })} className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Amount (K)</label>
                <input type="number" step="0.01" required value={reviewForm.amount} onChange={(e) => setReviewForm({ ...reviewForm, amount: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label-field">Date</label>
                <input type="date" required value={reviewForm.expense_date} onChange={(e) => setReviewForm({ ...reviewForm, expense_date: e.target.value })} className="input-field" />
              </div>
            </div>
            {reviewing.extracted_fields?.items?.length > 0 && (
              <div>
                <label className="label-field">Detected Line Items (reference only)</label>
                <div className="bg-slate-100 dark:bg-white/5 rounded-xl p-3 space-y-1 max-h-32 overflow-y-auto">
                  {reviewing.extracted_fields.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span className="truncate">{item.description}</span>
                      <span className="font-semibold shrink-0 ml-2">K {item.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => handleDiscard(reviewing)} className="btn-ghost flex-1 py-3 rounded-xl font-bold text-sm text-rose-500 flex items-center justify-center gap-1.5">
                <XCircle className="w-4 h-4" /> Discard
              </button>
              <button type="submit" disabled={committing} className="btn-gold flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-60">
                {committing ? 'Saving…' : 'Save as Expense'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
