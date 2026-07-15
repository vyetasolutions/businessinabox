import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getCachedDocuments, cacheDocumentsBulk } from '../lib/offlineSync';
import { useAuth } from '../context/AuthContext';
import { planAllows } from '../lib/plans';
import { downloadCsv } from '../lib/csvExport';

function buildCrmMap(documents) {
  const matrix = {};
  documents.forEach((doc) => {
    const name = doc.customer_name || doc.customerName;
    if (!name) return;
    if (!matrix[name]) {
      matrix[name] = { phone: doc.customer_phone || doc.customerPhone || 'N/A', address: doc.customer_address || doc.customerAddress || 'N/A', spend: 0 };
    }
    matrix[name].spend += Number(doc.total) || 0;
  });
  return matrix;
}

export default function Customers() {
  const { organization } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (navigator.onLine && organization?.id) {
        const { data, error } = await supabase
          .from('documents')
          .select('customer_name, customer_phone, customer_address, total')
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false })
          .limit(500);
        if (!error && data) {
          setDocuments(data);
          cacheDocumentsBulk(data);
        } else {
          setDocuments(getCachedDocuments());
        }
      } else {
        setDocuments(getCachedDocuments());
      }
      setLoading(false);
    };
    load();
  }, [organization?.id]);

  const crmMap = buildCrmMap(documents);
  const entries = Object.entries(crmMap);
  const reportsEnabled = planAllows(organization, 'reports');

  const exportCsv = () => {
    downloadCsv(
      'vyeta-customers',
      entries.map(([name, data]) => ({
        Name: name,
        Phone: data.phone,
        Address: data.address,
        'Total Billing (K)': data.spend.toFixed(2)
      }))
    );
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
        <h4 className="section-eyebrow">Saved Customer Directory</h4>
        {reportsEnabled && (
          <button onClick={exportCsv} className="btn-ghost px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-bold">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100/70 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-400 uppercase font-bold">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Phone</th>
              <th className="px-6 py-4">Address</th>
              <th className="px-6 py-4 text-right">Total Billing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/10">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-sm">
                  Loading customers…
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-sm">
                  No customers saved yet.
                </td>
              </tr>
            ) : (
              entries.map(([name, data]) => (
                <tr key={name} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{name}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{data.phone}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{data.address}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-slate-100">
                    K {data.spend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
