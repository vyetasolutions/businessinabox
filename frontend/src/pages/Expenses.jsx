import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Receipt, Download } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { planAllows } from '../lib/plans';
import UpgradePrompt from '../components/UpgradePrompt';
import { downloadCsv } from '../lib/csvExport';

const CATEGORIES = ['Rent', 'Utilities', 'Stock Purchase', 'Transport', 'Salaries', 'Marketing', 'Other'];

export default function Expenses() {
  const { organization, user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'Other', description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10) });

  const enabled = planAllows(organization, 'expense_tracking');
  const reportsEnabled = planAllows(organization, 'reports');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(200);
    if (!error) setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (enabled) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  if (!enabled) {
    return <UpgradePrompt feature="Expense tracking" requiredPlan="professional" />;
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const handleAdd = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('expenses').insert({
      organization_id: organization.id,
      category: form.category,
      description: form.description || null,
      amount: Number(form.amount) || 0,
      expense_date: form.expense_date,
      created_by: user?.id
    });
    if (error) {
      alert('Could not save expense: ' + error.message);
      return;
    }
    setShowForm(false);
    setForm({ category: 'Other', description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10) });
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense record?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) alert('Could not delete: ' + error.message);
    load();
  };

  const exportCsv = () => {
    downloadCsv(
      'vyeta-expenses',
      expenses.map((e) => ({
        Date: e.expense_date,
        Category: e.category,
        Description: e.description || '',
        'Amount (K)': e.amount
      }))
    );
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="glass-panel rounded-2xl p-6 flex justify-between items-center">
        <div>
          <span className="section-eyebrow">Total Expenses (last 200 records)</span>
          <h3 className="stat-value">K {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="flex gap-2">
          {reportsEnabled && (
            <button onClick={exportCsv} className="btn-ghost px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="btn-gold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl divide-y divide-slate-200 dark:divide-white/10">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : expenses.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            <Receipt className="w-6 h-6 mx-auto mb-2 opacity-50" />
            No expenses recorded yet.
          </p>
        ) : (
          expenses.map((exp) => (
            <div key={exp.id} className="p-4 flex justify-between items-center text-sm">
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">{exp.category}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {exp.description ? `${exp.description} · ` : ''}
                  {new Date(exp.expense_date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-900 dark:text-white">K {Number(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <button onClick={() => handleDelete(exp.id)} className="p-1 text-slate-400 hover:text-rose-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAdd} className="glass-panel max-w-sm w-full p-6 rounded-3xl space-y-4 animate-fade-in">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Expense</h3>
            <div>
              <label className="label-field">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Description (optional)</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Amount (K)</label>
                <input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label-field">Date</label>
                <input type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="input-field" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 py-3 rounded-xl font-bold text-sm">
                Cancel
              </button>
              <button type="submit" className="btn-gold flex-1 py-3 rounded-xl font-bold text-sm">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
