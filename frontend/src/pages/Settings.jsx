import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { organization, refreshOrganization } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', tpin: '', address: '', banking_details: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (organization) {
      setForm({
        name: organization.name || '',
        phone: organization.phone || '',
        tpin: organization.tpin || '',
        address: organization.address || '',
        banking_details: organization.banking_details || ''
      });
    }
  }, [organization]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('organizations').update(form).eq('id', organization.id);
    setSaving(false);
    if (error) {
      alert('Could not save: ' + error.message);
      return;
    }
    await refreshOrganization();
    alert('Business profile updated successfully!');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-panel p-6 rounded-2xl space-y-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Business Profile Settings</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            This information appears on every PDF document you generate.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Registered Business Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Business Phone Number</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g., +260 977 123456" className="input-field" />
          </div>
          <div>
            <label className="label-field">TPIN (Taxpayer Identification No.)</label>
            <input value={form.tpin} onChange={(e) => setForm({ ...form, tpin: e.target.value })} placeholder="10xxxxxxxx" className="input-field" />
          </div>
          <div>
            <label className="label-field">Physical Business Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g., Suite 4, Longacres, Lusaka" className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Banking Details / Settlement Terms</label>
            <textarea
              rows={3}
              value={form.banking_details}
              onChange={(e) => setForm({ ...form, banking_details: e.target.value })}
              placeholder={'e.g., Indo Zambia Bank\nAcc Name: Vyeta Digital Solutions\nAcc No: 001xxxxxxxx\nBranch: Lusaka Main'}
              className="input-field"
            />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-gold w-full py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Settings Profile'}
        </button>
      </div>
    </div>
  );
}
