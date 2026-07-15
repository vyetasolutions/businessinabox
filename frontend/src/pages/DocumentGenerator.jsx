import React, { useMemo, useState } from 'react';
import { ListPlus, Trash2, FileCheck2 } from 'lucide-react';
import { useDocumentSubmission } from '../lib/useDocumentSubmission';
import SuccessModal from '../components/SuccessModal';
import { useAuth } from '../context/AuthContext';
import { planAllows } from '../lib/plans';

const ALL_DOC_TYPES = ['Invoice', 'Quotation', 'Receipt', 'Delivery Note'];

function emptyItem() {
  return { desc: '', qty: 1, price: '' };
}

export default function DocumentGenerator() {
  const { organization } = useAuth();
  const DOC_TYPES = ALL_DOC_TYPES.filter((t) => t !== 'Delivery Note' || planAllows(organization, 'delivery_note'));
  const [docType, setDocType] = useState('Invoice');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [taxRate, setTaxRate] = useState(0);
  const [discountRate, setDiscountRate] = useState(0);
  const [result, setResult] = useState(null);

  const { submit, submitting } = useDocumentSubmission();

  const totals = useMemo(() => {
    const packedItems = items
      .filter((i) => i.desc || Number(i.price) > 0)
      .map((i) => ({ desc: i.desc || 'Service Item', qty: Number(i.qty) || 0, price: Number(i.price) || 0, total: (Number(i.qty) || 0) * (Number(i.price) || 0) }));
    const subtotal = packedItems.reduce((sum, i) => sum + i.total, 0);
    const discountAmount = subtotal * ((Number(discountRate) || 0) / 100);
    const taxAmount = (subtotal - discountAmount) * ((Number(taxRate) || 0) / 100);
    const total = subtotal - discountAmount + taxAmount;
    return { packedItems, subtotal, discountAmount, taxAmount, total };
  }, [items, taxRate, discountRate]);

  const updateItem = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setItems([emptyItem()]);
    setTaxRate(0);
    setDiscountRate(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await submit({
      docType,
      customerName,
      customerPhone,
      customerAddress,
      items: totals.packedItems,
      subtotal: totals.subtotal,
      discountRate: Number(discountRate) || 0,
      discountAmount: totals.discountAmount,
      taxRate: Number(taxRate) || 0,
      taxAmount: totals.taxAmount,
      total: totals.total
    });
    if (res.success) {
      setResult(res);
      resetForm();
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="section-eyebrow">1. Basic Info</h3>
            <div>
              <label className="label-field">Document Type</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input-field">
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="section-eyebrow">2. Customer Details</h3>
            <div>
              <label className="label-field">Customer / Company Name</label>
              <input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g., John Doe or Acme Corp" className="input-field" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-field">Customer Phone Number</label>
                <input required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="e.g., 097xxxxxxx" className="input-field" />
              </div>
              <div>
                <label className="label-field">Customer Address</label>
                <input required value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="e.g., Plot 12, Great East Road" className="input-field" />
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="section-eyebrow">3. Line Items</h3>
              <button type="button" onClick={addItem} className="btn-ghost text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                <ListPlus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="col-span-6 sm:col-span-7 input-field !px-3 !py-2.5 text-xs"
                    placeholder="Description of service or item"
                    value={item.desc}
                    onChange={(e) => updateItem(idx, 'desc', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    min="1"
                    className="col-span-2 input-field !px-2 !py-2.5 text-xs text-center"
                    value={item.qty}
                    onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="col-span-3 sm:col-span-2 input-field !px-3 !py-2.5 text-xs text-right"
                    placeholder="Price"
                    value={item.price}
                    onChange={(e) => updateItem(idx, 'price', e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => removeItem(idx)} className="col-span-1 flex justify-center text-slate-400 hover:text-rose-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Tax / VAT (%)</label>
              <input type="number" min="0" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label-field">Discount (%)</label>
              <input type="number" min="0" max="100" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} className="input-field" />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn-gold w-full py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
            <FileCheck2 className="w-5 h-5" /> {submitting ? 'Generating document…' : 'Create Document'}
          </button>
        </form>

        <div className="space-y-4">
          <div className="glass-panel p-6 rounded-2xl sticky top-24">
            <span className="section-eyebrow">Live Summary</span>
            <div className="mt-6 space-y-4 border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                <span className="text-slate-900 dark:text-white">K {totals.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span className="text-rose-500">Discount</span>
                <span className="text-rose-500">- K {totals.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span className="text-slate-500 dark:text-slate-400">Tax</span>
                <span className="text-slate-900 dark:text-white">K {totals.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Total Amount</span>
              <span className="text-2xl font-bold text-gold-600 dark:text-gold-400">K {totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      <SuccessModal result={result} onClose={() => setResult(null)} />
    </div>
  );
}
