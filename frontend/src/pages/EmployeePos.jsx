import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, ReceiptText, ScanLine } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useDocumentSubmission } from '../lib/useDocumentSubmission';
import SuccessModal from '../components/SuccessModal';
import BarcodeScanner from '../components/BarcodeScanner';

export default function EmployeePos() {
  const [query, setQuery] = useState('');
  const [stockResults, setStockResults] = useState([]);
  const [cart, setCart] = useState([]); // {id, name, price, costPrice, qty}
  const [docType, setDocType] = useState('Receipt');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [result, setResult] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  const { submit, submitting } = useDocumentSubmission();

  useEffect(() => {
    const search = async () => {
      let req = supabase.from('inventory').select('id, name, unit_price, cost_price, quantity_on_hand, sku').order('name').limit(20);
      if (query.trim()) req = req.or(`name.ilike.%${query.trim()}%,sku.ilike.%${query.trim()}%`);
      const { data, error } = await req;
      if (!error) setStockResults(data || []);
    };
    const t = setTimeout(search, 250);
    return () => clearTimeout(t);
  }, [query]);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { id: item.id, name: item.name, price: item.unit_price, costPrice: item.cost_price || 0, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c)).filter(Boolean));
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((c) => c.id !== id));

  const totals = useMemo(() => {
    const items = cart.map((c) => ({ desc: c.name, qty: c.qty, price: c.price, costPrice: c.costPrice, total: c.qty * c.price }));
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    return { items, subtotal };
  }, [cart]);

  const resetSale = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert('Add at least one item before generating a document.');
      return;
    }

    const res = await submit({
      docType,
      customerName,
      customerPhone,
      customerAddress,
      items: totals.items,
      subtotal: totals.subtotal,
      discountRate: 0,
      discountAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      total: totals.subtotal
    });

    if (!res.success) {
      alert(`Error: ${res.error}`);
      return;
    }

    // Only decrement real stock for confirmed sales (Receipts), not for Quotations,
    // and only when online — offline sales sync their stock impact once reconnected
    // is out of scope for the free-tier build, so we decrement optimistically here.
    if (docType === 'Receipt' && navigator.onLine) {
      for (const item of cart) {
        await supabase.rpc('pos_decrement_stock', { p_inventory_id: item.id, p_qty: item.qty });
      }
    }

    setResult(res);
    resetSale();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* ---- Stock picker ---- */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stock to sell…" className="input-field !pl-9" />
          </div>
          <button type="button" onClick={() => setShowScanner(true)} className="btn-ghost px-3 rounded-xl shrink-0" title="Scan barcode">
            <ScanLine className="w-4 h-4" />
          </button>
        </div>
        <div className="glass-panel rounded-2xl divide-y divide-slate-200 dark:divide-white/10 max-h-[28rem] overflow-y-auto">
          {stockResults.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">No stock items found.</p>
          ) : (
            stockResults.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                disabled={item.quantity_on_hand <= 0}
                className="w-full flex justify-between items-center p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
              >
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{item.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {item.quantity_on_hand > 0 ? `${item.quantity_on_hand} in stock` : 'Out of stock'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gold-600 dark:text-gold-400 text-sm">K {Number(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <Plus className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ---- Cart + customer + submit ---- */}
      <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
        <div className="glass-panel rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gold-500" />
            <h4 className="section-eyebrow">Current Sale</h4>
          </div>
          {cart.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Tap a stock item to add it here.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-slate-900 dark:text-slate-100">{item.name}</p>
                    <p className="text-[11px] text-slate-400">K {item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => updateQty(item.id, -1)} className="p-1 rounded-md btn-ghost">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold">{item.qty}</span>
                    <button type="button" onClick={() => updateQty(item.id, 1)} className="p-1 rounded-md btn-ghost">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => removeFromCart(item.id)} className="p-1 text-rose-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-white/10">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total</span>
            <span className="text-xl font-bold text-gold-600 dark:text-gold-400">
              K {totals.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 space-y-3">
          <div>
            <label className="label-field">Document Type</label>
            <div className="grid grid-cols-2 gap-2">
              {['Receipt', 'Quotation'].map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setDocType(type)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                    docType === type ? 'btn-gold' : 'btn-ghost'
                  }`}
                >
                  {type === 'Receipt' ? 'Sale (Receipt)' : 'Quotation'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label-field">Customer Name</label>
            <input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-field" placeholder="Customer name" />
          </div>
          <div>
            <label className="label-field">Customer Phone</label>
            <input required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input-field" placeholder="097xxxxxxx" />
          </div>
          <div>
            <label className="label-field">Address (optional)</label>
            <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="input-field" placeholder="Optional" />
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-gold w-full py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
          <ReceiptText className="w-5 h-5" /> {submitting ? 'Generating…' : `Complete ${docType === 'Receipt' ? 'Sale' : 'Quotation'}`}
        </button>
      </form>

      <SuccessModal result={result} onClose={() => setResult(null)} />
      {showScanner && <BarcodeScanner onDetected={(code) => { setShowScanner(false); setQuery(code); }} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
