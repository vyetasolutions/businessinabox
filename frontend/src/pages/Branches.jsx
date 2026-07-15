import React, { useEffect, useState } from 'react';
import { Plus, MapPin, Star, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { planAllows } from '../lib/plans';
import UpgradePrompt from '../components/UpgradePrompt';

export default function Branches() {
  const { organization } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('branches').select('*').order('created_at');
    if (!error) setBranches(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [organization?.id]);

  if (!planAllows(organization, 'multi_branch')) {
    return <UpgradePrompt feature="Multiple branches" requiredPlan="business_plus" />;
  }

  const handleAdd = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('branches').insert({
      organization_id: organization.id,
      name: form.name,
      address: form.address || null,
      phone: form.phone || null,
      is_primary: false
    });
    if (error) {
      alert('Could not add branch: ' + error.message);
      return;
    }
    setShowForm(false);
    setForm({ name: '', address: '', phone: '' });
    load();
  };

  const handleDelete = async (branch) => {
    if (branch.is_primary) return;
    if (!confirm(`Remove ${branch.name}? Stock and documents tagged to it will be untagged, not deleted.`)) return;
    const { error } = await supabase.from('branches').delete().eq('id', branch.id);
    if (error) alert('Could not remove branch: ' + error.message);
    load();
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <h4 className="section-eyebrow">Your Branches</h4>
        <button onClick={() => setShowForm(true)} className="btn-gold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Add Branch
        </button>
      </div>

      <div className="glass-panel rounded-2xl divide-y divide-slate-200 dark:divide-white/10">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : (
          branches.map((b) => (
            <div key={b.id} className="p-5 flex justify-between items-center">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    {b.name}
                    {b.is_primary && <Star className="w-3.5 h-3.5 text-gold-500 fill-gold-500" />}
                  </p>
                  {b.address && <p className="text-xs text-slate-500 dark:text-slate-400">{b.address}</p>}
                  {b.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{b.phone}</p>}
                </div>
              </div>
              {!b.is_primary && (
                <button onClick={() => handleDelete(b)} className="p-1.5 text-slate-400 hover:text-rose-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAdd} className="glass-panel max-w-sm w-full p-6 rounded-3xl space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Branch</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-rose-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="label-field">Branch Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g., Kitwe Branch" />
            </div>
            <div>
              <label className="label-field">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
            </div>
            <button type="submit" className="btn-gold w-full py-3 rounded-xl font-bold">
              Add Branch
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
