import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabaseClient';
import { buildDocumentPdf, uploadPdfToStorage, fetchImageAsDataUrl } from './pdfGenerator';
import { queueDocumentOffline } from './offlineSync';
import { useAuth } from '../context/AuthContext';
import { planAllows } from './plans';

/**
 * Handles the full lifecycle of creating a document (Invoice/Quotation/
 * Receipt/Delivery Note): builds the PDF client-side, saves it online to
 * Supabase or offline to localStorage, and returns everything the UI needs
 * to show a success state (pdf link + prefilled WhatsApp share link).
 */
export function useDocumentSubmission() {
  const { profile, organization, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (form) => {
    setSubmitting(true);
    try {
      const syncToken = uuidv4();
      const logoDataUrl =
        planAllows(organization, 'custom_branding') && organization?.logo_url && navigator.onLine
          ? await fetchImageAsDataUrl(organization.logo_url)
          : null;
      const pdfBlob = buildDocumentPdf({
        businessName: organization?.name,
        businessPhone: organization?.phone,
        tpin: organization?.tpin,
        address: organization?.address,
        banking: organization?.banking_details,
        logoDataUrl,
        docType: form.docType,
        docId: syncToken.slice(0, 8).toUpperCase(),
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerAddress: form.customerAddress,
        items: form.items,
        subtotal: form.subtotal,
        discountAmount: form.discountAmount,
        taxRate: form.taxRate,
        taxAmount: form.taxAmount,
        total: form.total
      });

      const fileName = `${organization?.id}/${form.docType.replace(/\s+/g, '-')}-${syncToken}.pdf`;

      const basePayload = {
        organization_id: organization?.id,
        created_by: user?.id,
        sync_token: syncToken,
        doc_type: form.docType,
        customer_name: form.customerName,
        customer_phone: form.customerPhone,
        customer_address: form.customerAddress,
        items: form.items,
        subtotal: form.subtotal,
        discount_rate: form.discountRate,
        discount_amount: form.discountAmount,
        tax_rate: form.taxRate,
        tax_amount: form.taxAmount,
        total: form.total,
        status: 'issued'
      };

      let pdfUrl = null;
      let isOfflineSave = false;

      if (navigator.onLine) {
        try {
          pdfUrl = await uploadPdfToStorage(pdfBlob, fileName);
          const { error } = await supabase.from('documents').insert({ ...basePayload, pdf_url: pdfUrl });
          if (error) throw error;
        } catch (err) {
          // Network dropped mid-submit, or Supabase unreachable — fall back to offline queue
          isOfflineSave = true;
          pdfUrl = URL.createObjectURL(pdfBlob);
          queueDocumentOffline({ ...basePayload, pdf_url: null });
        }
      } else {
        isOfflineSave = true;
        pdfUrl = URL.createObjectURL(pdfBlob);
        queueDocumentOffline({ ...basePayload, pdf_url: null });
      }

      const whatsappMessage = `Thanks for choosing ${organization?.name || 'us'}. Here is your ${form.docType.toLowerCase()}: ${
        isOfflineSave ? '(link will be sent once we are back online)' : pdfUrl
      }`;
      const whatsappLink = `https://wa.me/${(form.customerPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
        whatsappMessage
      )}`;

      return { success: true, pdfUrl, whatsappLink, isOfflineSave, docId: syncToken.slice(0, 8).toUpperCase() };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message || 'Something went wrong while creating the document.' };
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitting };
}
