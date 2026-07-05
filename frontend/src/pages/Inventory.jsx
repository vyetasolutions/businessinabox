import React, { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Pencil, X, PackageSearch } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const emptyForm = { name: '', sku: '', category: '', unit_price: '', quantity_on_hand: '', low_stock_alert: 5 };

export default function Inventory() {
  const { isManager, organization } = useAuth();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadInventory = async () => {
    setLoading(true);
    let req = supabase.from('inventory').select('*').order('name', { ascending: true });
    if (query.trim()) req = req.ilike('name', `%${query.trim()}%`);
    const { data, error } = await req;
    if (!error) setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  useEffect(() => {
    const t = setTimeout(loadInventory, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const openNewForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setForm({
      name: item.name,
      sku: item.sku || '',
      category: item.category || '',
      unit_price: item.unit_price,
      quantity_on_hand: item.quantity_on_hand,
      low_stock_alert: item.low_stock_alert
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      organization_id: organization?.id,
      name: form.name,
      sku: form.sku || null,
      category: form.category || null,
      unit_price: Number(form.unit_price) || 0,
      quantity_on_hand: Number(form.quantity_on_hand) || 0,
      low_stock_alert: Number(form.low_stock_alert) || 0
    };

    const { error } = editingId
      ? await supabase.from('inventory').update(payload).eq('id', editingId)
      : await supabase.from('inventory').insert(payload);

    if (error) {
      alert('Could not save item: ' + error.message);
      return;
    }
    setShowForm(false);
    loadInventory();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this item from stock permanently?')) return;
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) alert('Could not delete item: ' + error.message);
    loadInventory();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stock by name…"
            className="input-field !pl-9"
          />
        </div>
        {isManager && (
          <button onClick={openNewForm} className="btn-gold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm justify-center">
            <Plus className="w-4 h-4" /> Add Stock Item
          </button>
        )}
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/70 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-400 uppercase font-bold">
              <tr>
                <th className="px-6 py-4">Item</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Price</th>
                <th className="px-6 py-4 text-right">In Stock</th>
                {isManager && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">
                    Loading stock…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">
                    <PackageSearch className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    No stock items found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                      {item.sku && <p className="text-[11px] text-slate-400">SKU: {item.sku}</p>}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{item.category || '—'}</td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                      K {Number(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`font-bold ${
                          item.quantity_on_hand <= item.low_stock_alert ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {item.quantity_on_hand}
                      </span>
                    </td>
                    {isManager && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEditForm(item)} className="p-1.5 text-slate-400 hover:text-gold-500">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-rose-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && isManager && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="glass-panel max-w-md w-full p-6 rounded-3xl space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingId ? 'Edit Stock Item' : 'Add Stock Item'}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-rose-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="label-field">Item Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">SKU (optional)</label>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label-field">Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Unit Price (K)</label>
                <input type="number" step="0.01" required value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label-field">Quantity in Stock</label>
                <input type="number" required value={form.quantity_on_hand} onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })} className="input-field" />
              </div>
            </div>
            <div>
              <label className="label-field">Low Stock Alert Threshold</label>
              <input type="number" value={form.low_stock_alert} onChange={(e) => setForm({ ...form, low_stock_alert: e.target.value })} className="input-field" />
            </div>
            <button type="submit" className="btn-gold w-full py-3 rounded-xl font-bold">
              {editingId ? 'Save Changes' : 'Add to Stock'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
