import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabaseClient';

/**
 * Builds a branded PDF document entirely in the browser (no server round-trip
 * required), so it works even when the device is offline. Returns a Blob.
 */
export function buildDocumentPdf(payload) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  // ---- Header ----
  doc.setFillColor(10, 17, 40); // midnight-900
  doc.rect(0, 0, pageWidth, 90, 'F');

  doc.setTextColor(212, 151, 42); // gold-500
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(payload.businessName || 'My Business', marginX, 40);

  doc.setTextColor(230, 230, 235);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const headerLines = [payload.address, payload.businessPhone, payload.tpin ? `TPIN: ${payload.tpin}` : null].filter(Boolean);
  doc.text(headerLines.join('   |   '), marginX, 58);

  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(payload.docType.toUpperCase(), pageWidth - marginX, 40, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - marginX, 58, { align: 'right' });
  doc.text(`Ref: ${payload.docId || 'PENDING'}`, pageWidth - marginX, 70, { align: 'right' });

  // ---- Customer block ----
  let y = 120;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BILLED TO', marginX, y);
  doc.setFont('helvetica', 'normal');
  y += 16;
  doc.setFontSize(11);
  doc.text(payload.customerName || '', marginX, y);
  y += 14;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (payload.customerPhone) {
    doc.text(payload.customerPhone, marginX, y);
    y += 12;
  }
  if (payload.customerAddress) {
    doc.text(payload.customerAddress, marginX, y);
    y += 12;
  }

  // ---- Line items table ----
  const rows = (payload.items || []).map((item) => [
    item.desc,
    String(item.qty),
    `K ${Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `K ${Number(item.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  ]);

  autoTable(doc, {
    startY: y + 14,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: rows,
    theme: 'plain',
    headStyles: { fillColor: [10, 17, 40], textColor: [212, 151, 42], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 8, lineColor: [226, 232, 240], lineWidth: 0.5 },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  });

  let finalY = doc.lastAutoTable.finalY + 20;

  // ---- Totals ----
  const totalsX = pageWidth - marginX - 180;
  const printTotalsLine = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(bold ? 10 : 100, bold ? 17 : 116, bold ? 40 : 139);
    doc.text(label, totalsX, finalY);
    doc.text(value, pageWidth - marginX, finalY, { align: 'right' });
    finalY += bold ? 22 : 16;
  };

  printTotalsLine('Subtotal', `K ${Number(payload.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  if (payload.discountAmount) {
    printTotalsLine('Discount', `- K ${Number(payload.discountAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  }
  if (payload.taxAmount) {
    printTotalsLine(`Tax (${payload.taxRate || 0}%)`, `K ${Number(payload.taxAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  }
  printTotalsLine('TOTAL', `K ${Number(payload.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, true);

  // ---- Banking / footer ----
  if (payload.banking) {
    finalY += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('SETTLEMENT DETAILS', marginX, finalY);
    finalY += 14;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(payload.banking, pageWidth - marginX * 2), marginX, finalY);
  }

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Generated with Vyeta Business Hub', marginX, doc.internal.pageSize.getHeight() - 30);

  return doc.output('blob');
}

/**
 * Uploads the generated PDF to the shared Supabase Storage bucket and
 * returns a public URL. Only called when the device is online — while
 * offline, the caller keeps a local object URL instead (see DocumentGenerator.jsx).
 */
export async function uploadPdfToStorage(blob, fileName) {
  const path = `${fileName}`;
  const { error } = await supabase.storage.from('documents').upload(path, blob, {
    contentType: 'application/pdf',
    upsert: true
  });
  if (error) throw error;

  const { data } = supabase.storage.from('documents').getPublicUrl(path);
  return data.publicUrl;
}
