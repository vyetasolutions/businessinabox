// ============================================================================
// DOCUMENT INTELLIGENCE — TEXT EXTRACTION
// ============================================================================
// Deliberately lightweight, per the brief: no heavy ML pipeline, no
// enterprise document-AI service. Two extraction paths:
//
//   1. NATIVE (free, instant, most accurate when it applies): if the file
//      already has a text layer — a digital PDF or a Word doc — just read
//      the text directly. Most contracts/certificates and many supplier
//      invoices are already digital documents, not photos, so this covers
//      more cases than you'd expect and costs nothing.
//
//   2. OCR FALLBACK (OCR.space API, generous free tier): used only for
//      images (photographed receipts) or PDFs with no usable text layer
//      (scanned documents). This is the one part of the platform with a
//      real per-use cost once free-tier limits are exceeded — see
//      PLATFORM_DOCUMENTATION.md for the honest cost/scaling discussion.
// ============================================================================

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';
const MIN_USABLE_NATIVE_TEXT_LENGTH = 25; // below this, assume the PDF is a scanned image, not real text

async function extractNativePdfText(buffer) {
  try {
    const result = await pdfParse(buffer);
    return (result.text || '').trim();
  } catch {
    return '';
  }
}

async function extractDocxText(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || '').trim();
  } catch {
    return '';
  }
}

async function extractViaOcrSpace(buffer, mimeType) {
  if (!process.env.OCR_SPACE_API_KEY) {
    throw new Error('OCR is not configured on the server (missing OCR_SPACE_API_KEY).');
  }

  const base64 = buffer.toString('base64');
  const body = new URLSearchParams({
    apikey: process.env.OCR_SPACE_API_KEY,
    base64Image: `data:${mimeType};base64,${base64}`,
    OCREngine: '2', // more accurate engine, still within the free tier
    scale: 'true',
    isTable: 'true' // helps with receipt/invoice line-item layouts
  });

  const res = await fetch(OCR_SPACE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await res.json();

  if (data.IsErroredOnProcessing) {
    throw new Error(data.ErrorMessage?.[0] || 'OCR processing failed.');
  }

  return (data.ParsedResults || []).map((r) => r.ParsedText).join('\n').trim();
}

/**
 * Main entry point. Picks the cheapest accurate method for the given file
 * type, falling back to OCR only when necessary.
 *
 * `onBeforeOcrCall`, if provided, is awaited immediately before any actual
 * OCR.space call (both the direct-image path and the scanned-PDF fallback
 * path) — it should throw if the caller's monthly quota is exhausted. This
 * lives here, right at the point of spending money, rather than as a
 * separate pre-check before extraction starts, because a PDF's need for OCR
 * isn't known until native extraction is attempted and comes up short.
 */
async function extractText(buffer, mimeType, { onBeforeOcrCall } = {}) {
  if (mimeType === 'application/pdf') {
    const nativeText = await extractNativePdfText(buffer);
    if (nativeText.length >= MIN_USABLE_NATIVE_TEXT_LENGTH) {
      return { text: nativeText, method: 'native-pdf' };
    }
    // No usable text layer — it's a scanned PDF, fall back to OCR
    if (onBeforeOcrCall) await onBeforeOcrCall();
    const ocrText = await extractViaOcrSpace(buffer, mimeType);
    return { text: ocrText, method: 'ocr-fallback' };
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const text = await extractDocxText(buffer);
    return { text, method: 'native-docx' };
  }

  if (mimeType.startsWith('image/')) {
    if (onBeforeOcrCall) await onBeforeOcrCall();
    const text = await extractViaOcrSpace(buffer, mimeType);
    return { text, method: 'ocr' };
  }

  throw new Error(`Unsupported file type for text extraction: ${mimeType}`);
}

// ----------------------------------------------------------------------------
// Lightweight field guessing for receipts/invoices/delivery notes.
// Deliberately simple, regex-based heuristics — NOT a claim of high accuracy.
// This is why the frontend always shows a review/edit step before anything
// is committed to the business's actual expense records.
// ----------------------------------------------------------------------------
function guessStructuredFields(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Vendor: usually the first substantial line (business name at the top of a receipt)
  const vendor = lines.find((l) => l.length > 2 && !/^\d+$/.test(l)) || null;

  // Date: look for common formats (dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, "12 Jul 2026")
  const datePatterns = [
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/,
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i
  ];
  let date = null;
  for (const pattern of datePatterns) {
    const match = rawText.match(pattern);
    if (match) {
      date = match[1];
      break;
    }
  }

  // Total: find lines mentioning total/amount due, pull the number from that line;
  // if several candidates, take the largest (grand total is usually the biggest figure).
  const totalKeywords = /total|amount due|grand total|balance due/i;
  const numberPattern = /[\d,]+\.\d{2}|\d+/g;
  let total = null;
  lines
    .filter((l) => totalKeywords.test(l))
    .forEach((l) => {
      const numbers = (l.match(numberPattern) || []).map((n) => parseFloat(n.replace(/,/g, '')));
      const candidate = Math.max(...numbers, 0);
      if (candidate > 0 && (total === null || candidate > total)) total = candidate;
    });

  // Line items: best-effort only — lines that end in a plausible price.
  // Deliberately capped and clearly a starting point for manual correction.
  const itemPattern = /^(.{3,40}?)\s+([\d,]+\.\d{2})$/;
  const items = lines
    .map((l) => l.match(itemPattern))
    .filter(Boolean)
    .slice(0, 20)
    .map((m) => ({ description: m[1].trim(), amount: parseFloat(m[2].replace(/,/g, '')) }));

  return { vendor, date, total, items };
}

module.exports = { extractText, guessStructuredFields };
