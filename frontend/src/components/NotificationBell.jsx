import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { planAllows } from '../lib/plans';

export default function NotificationBell() {
  const { organization, isManager } = useAuth();
  const [lowStockItems, setLowStockItems] = useState([]);
  const [open, setOpen] = useState(false);

  const eligible = isManager && planAllows(organization, 'inventory');

  useEffect(() => {
    if (!eligible) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, name, quantity_on_hand, low_stock_alert')
        .order('quantity_on_hand', { ascending: true })
        .limit(100);
      if (!error && data) {
        setLowStockItems(data.filter((i) => i.quantity_on_hand <= i.low_stock_alert));
      }
    };
    load();
    const interval = setInterval(load, 60000); // refresh every minute while the app is open
    return () => clearInterval(interval);
  }, [eligible, organization?.id]);

  if (!eligible) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative p-2.5 rounded-xl glass-panel">
        <Bell className="w-5 h-5" />
        {lowStockItems.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {lowStockItems.length > 9 ? '9+' : lowStockItems.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 glass-panel rounded-2xl overflow-hidden z-50 shadow-premium">
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Low Stock Alerts</h4>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 dark:divide-white/10">
              {lowStockItems.length === 0 ? (
                <p className="p-4 text-xs text-slate-400 text-center">All stock levels look healthy.</p>
              ) : (
                lowStockItems.map((item) => (
                  <div key={item.id} className="p-3 flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="flex-1 font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                    <span className="text-rose-500 font-bold">{item.quantity_on_hand} left</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
