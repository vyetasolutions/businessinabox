import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabaseClient';

const QUEUE_KEY = 'vyeta_offline_doc_queue';
const CACHE_DOCS_KEY = 'vyeta_cached_documents'; // last-known-good copy for offline dashboard viewing

// ---------------------------------------------------------------------------
// Local queue helpers
// ---------------------------------------------------------------------------
export function getQueuedDocuments() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Stage a document for saving. Always writes to localStorage immediately
 * (so the UI can show it right away, online or not), tagged with a UUID
 * sync_token used to de-duplicate if the same record is later pushed twice.
 */
export function queueDocumentOffline(documentPayload) {
  const queue = getQueuedDocuments();
  const record = {
    ...documentPayload,
    sync_token: documentPayload.sync_token || uuidv4(),
    _queued_at: new Date().toISOString(),
    _synced: false
  };
  queue.unshift(record);
  saveQueue(queue);
  cacheDocumentForOfflineView(record);
  return record;
}

function markSynced(syncToken) {
  const queue = getQueuedDocuments().filter((d) => d.sync_token !== syncToken);
  saveQueue(queue);
}

// ---------------------------------------------------------------------------
// Read-side cache, so the Dashboard/Customers views still render something
// meaningful while offline instead of an empty state.
// ---------------------------------------------------------------------------
export function cacheDocumentForOfflineView(doc) {
  const cached = getCachedDocuments();
  const withoutDup = cached.filter((d) => d.sync_token !== doc.sync_token);
  const updated = [doc, ...withoutDup].slice(0, 200);
  localStorage.setItem(CACHE_DOCS_KEY, JSON.stringify(updated));
}

export function cacheDocumentsBulk(docs) {
  localStorage.setItem(CACHE_DOCS_KEY, JSON.stringify(docs.slice(0, 200)));
}

export function getCachedDocuments() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_DOCS_KEY)) || [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sync engine — call `syncQueuedDocuments()` on app load and whenever the
// browser's `online` event fires. Safe to call repeatedly; it's a no-op if
// the queue is empty or the device is still offline.
// ---------------------------------------------------------------------------
export async function syncQueuedDocuments({ onProgress } = {}) {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const queue = getQueuedDocuments();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const doc of queue) {
    try {
      // Upsert on sync_token so re-running this never creates duplicate rows,
      // even if the same document was queued twice across app reloads.
      const { error } = await supabase.from('documents').upsert(
        {
          organization_id: doc.organization_id,
          created_by: doc.created_by,
          sync_token: doc.sync_token,
          doc_type: doc.doc_type,
          customer_name: doc.customer_name,
          customer_phone: doc.customer_phone,
          customer_address: doc.customer_address,
          items: doc.items,
          subtotal: doc.subtotal,
          discount_rate: doc.discount_rate,
          discount_amount: doc.discount_amount,
          tax_rate: doc.tax_rate,
          tax_amount: doc.tax_amount,
          total: doc.total,
          pdf_url: doc.pdf_url || null,
          status: doc.status || 'issued'
        },
        { onConflict: 'sync_token' }
      );

      if (error) throw error;

      markSynced(doc.sync_token);
      synced += 1;
      onProgress && onProgress({ doc, status: 'synced' });
    } catch (err) {
      failed += 1;
      onProgress && onProgress({ doc, status: 'failed', error: err.message });
    }
  }

  return { synced, failed };
}

/**
 * Registers listeners so sync happens automatically the moment connectivity
 * returns. Call once near the root of the app (see App.jsx).
 */
export function initOfflineSyncListener(onResult) {
  const handler = async () => {
    const result = await syncQueuedDocuments();
    onResult && onResult(result);
  };
  window.addEventListener('online', handler);
  // Also try once on load, in case we came back online while the tab was closed
  if (navigator.onLine) handler();
  return () => window.removeEventListener('online', handler);
}
