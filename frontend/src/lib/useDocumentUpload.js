import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase, BACKEND_URL } from './supabaseClient';
import { useAuth } from '../context/AuthContext';

/**
 * Handles the full upload → extract lifecycle shared by the Document Scanner
 * (receipts/invoices/delivery notes) and the Document Vault (contracts/
 * certificates). The two pages differ only in `pipeline` and what they do
 * with the result afterward.
 */
export function useDocumentUpload() {
  const { organization, user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const authedFetch = async (path, options = {}) => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    return fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
        ...(options.headers || {})
      }
    });
  };

  /**
   * @param {File} file
   * @param {'receipt'|'invoice'|'delivery_note'|'contract'|'certificate'|'other'} category
   * @param {'structured'|'vault'} pipeline
   * @param {string} [title]
   */
  const uploadAndProcess = async (file, category, pipeline, title) => {
    setUploading(true);
    try {
      const filePath = `${organization.id}/${uuidv4()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

      const { error: uploadError } = await supabase.storage.from('uploads').upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });
      if (uploadError) throw uploadError;

      const { data: record, error: insertError } = await supabase
        .from('document_uploads')
        .insert({
          organization_id: organization.id,
          uploaded_by: user.id,
          category,
          pipeline,
          title: title || file.name,
          file_path: filePath,
          file_type: file.type,
          status: 'queued'
        })
        .select()
        .single();
      if (insertError) throw insertError;

      const res = await authedFetch('/api/ocr/process-upload', {
        method: 'POST',
        body: JSON.stringify({ uploadId: record.id })
      });
      const data = await res.json();

      if (!data.success) {
        return { success: false, error: data.error, upload: record };
      }
      return { success: true, upload: data.upload };
    } catch (err) {
      return { success: false, error: err.message || 'Could not upload this document.' };
    } finally {
      setUploading(false);
    }
  };

  const getSignedFileUrl = async (filePath) => {
    const { data, error } = await supabase.storage.from('uploads').createSignedUrl(filePath, 60 * 10); // 10 minutes
    if (error) return null;
    return data.signedUrl;
  };

  const discardUpload = async (uploadRecord) => {
    await supabase.storage.from('uploads').remove([uploadRecord.file_path]);
    await supabase.from('document_uploads').delete().eq('id', uploadRecord.id);
  };

  return { uploadAndProcess, getSignedFileUrl, discardUpload, uploading, authedFetch };
}
