import React, { useEffect, useMemo, useState } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { ExternalLink, UserPlus, CheckCircle2, Download, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { BACKEND_URL } from '../lib/supabaseClient';
import { getCachedDocuments, cacheDocumentsBulk } from '../lib/offlineSync';
import { useAuth } from '../context/AuthContext';
import { planAllows } from '../lib/plans';
import { downloadCsv } from '../lib/csvExport';
import UpgradePrompt from '../components/UpgradePrompt';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

export default function ManagerDashboard() {
  const { organization } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeForm, setEmployeeForm] = useState({ fullName: '', email: '', password: '' });
  const [employeeStatus, setEmployeeStatus] = useState(null); // {type: 'success'|'error', message}
  const [creatingEmployee, setCreatingEmployee] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (navigator.onLine && organization?.id) {
        const { data, error } = await supabase
          .from('documents')
          .select('doc_type, total, created_at, customer_name, pdf_url, items')
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false })
          .limit(200);
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

  const metrics = useMemo(() => {
    let collected = 0;
    let outstanding = 0;
    let quotes = 0;
    let grossProfit = 0;
    let profitTrackedSales = 0;
    const splitMap = { Invoice: 0, Quotation: 0, Receipt: 0, 'Delivery Note': 0 };

    documents.forEach((doc) => {
      const val = Number(doc.total) || 0;
      const type = doc.doc_type || doc.docType;
      if (type === 'Receipt') collected += val;
      if (type === 'Invoice') outstanding += val;
      if (type === 'Quotation') quotes += 1;
      if (splitMap[type] !== undefined) splitMap[type] += 1;

      if ((type === 'Receipt' || type === 'Invoice') && Array.isArray(doc.items)) {
        doc.items.forEach((item) => {
          if (item.costPrice !== undefined && item.costPrice !== null) {
            grossProfit += (Number(item.price) - Number(item.costPrice)) * Number(item.qty);
            profitTrackedSales += 1;
          }
        });
      }
    });

    return { collected, outstanding, quotes, grossProfit, profitTrackedSales, splitMap };
  }, [documents]);

  const trendData = useMemo(() => {
    const recent = [...documents].reverse().slice(-6);
    return {
      labels: recent.map((d) => new Date(d.created_at || d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
      datasets: [
        {
          data: recent.map((d) => Number(d.total) || 0),
          borderColor: '#d4972a',
          backgroundColor: 'rgba(212, 151, 42, 0.08)',
          borderWidth: 2.5,
          tension: 0.35,
          fill: true
        }
      ]
    };
  }, [documents]);

  const mixData = {
    labels: ['Invoices', 'Quotations', 'Receipts', 'Delivery Notes'],
    datasets: [
      {
        data: [metrics.splitMap.Invoice, metrics.splitMap.Quotation, metrics.splitMap.Receipt, metrics.splitMap['Delivery Note']],
        backgroundColor: ['#2b4491', '#d4972a', '#10b981', '#6366f1'],
        borderWidth: 2,
        borderColor: '#0A1128'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { font: { size: 10, weight: '600' } } },
      y: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { font: { size: 10, weight: '600' } } }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: { legend: { position: 'bottom', labels: { font: { size: 11, weight: '600' } } } }
  };

  const reportsEnabled = planAllows(organization, 'reports');
  const multiUserEnabled = planAllows(organization, 'multi_user');

  const exportDocumentsCsv = () => {
    downloadCsv(
      'vyeta-documents',
      documents.map((d) => ({
        Type: d.doc_type || d.docType,
        Customer: d.customer_name || d.customerName,
        Date: new Date(d.created_at || d.date).toLocaleDateString(),
        'Total (K)': d.total
      }))
    );
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setEmployeeStatus(null);
    setCreatingEmployee(true);
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      const res = await fetch(`${BACKEND_URL}/api/create-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(employeeForm)
      });
      const data = await res.json();

      if (data.success) {
        setEmployeeStatus({ type: 'success', message: `Employee account created for ${data.employee.email}.` });
        setEmployeeForm({ fullName: '', email: '', password: '' });
      } else {
        setEmployeeStatus({ type: 'error', message: data.error || 'Could not create employee account.' });
      }
    } catch (err) {
      setEmployeeStatus({ type: 'error', message: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setCreatingEmployee(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {reportsEnabled && (
          <button onClick={exportDocumentsCsv} className="btn-ghost px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export Documents CSV
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-6 rounded-2xl">
          <span className="section-eyebrow">Total Received</span>
          <h3 className="stat-value">K {metrics.collected.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="glass-panel p-6 rounded-2xl">
          <span className="section-eyebrow">Unpaid Invoices</span>
          <h3 className="stat-value">K {metrics.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="glass-panel p-6 rounded-2xl">
          <span className="section-eyebrow">Sent Quotes</span>
          <h3 className="stat-value">{metrics.quotes}</h3>
        </div>
        <div className="glass-panel p-6 rounded-2xl">
          <span className="section-eyebrow flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> Gross Profit
          </span>
          {metrics.profitTrackedSales > 0 ? (
            <h3 className="stat-value">K {metrics.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          ) : (
            <p className="text-xs text-slate-400 mt-2">Sell items from Stock to see margin here.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2">
          <h4 className="section-eyebrow mb-4">Revenue Trend</h4>
          <div className="h-64 relative">{!loading && <Line data={trendData} options={chartOptions} />}</div>
        </div>
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <h4 className="section-eyebrow mb-4">Document Mix</h4>
          <div className="h-48 relative flex items-center justify-center">{!loading && <Doughnut data={mixData} options={doughnutOptions} />}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-white/10">
            <h4 className="section-eyebrow">Recent Documents</h4>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-white/10 overflow-x-auto no-scrollbar max-h-96">
            {documents.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 font-medium">No documents generated yet.</p>
            ) : (
              documents.slice(0, 8).map((doc, idx) => (
                <div key={idx} className="p-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-white/5 flex justify-between items-center text-xs sm:text-sm transition-colors">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{doc.customer_name || doc.customerName}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      {doc.doc_type || doc.docType} • {new Date(doc.created_at || doc.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 dark:text-white">K {Number(doc.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    {doc.pdf_url && (
                      <a href={doc.pdf_url} target="_blank" rel="noreferrer" className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-gold-500">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ---- Add Employee ---- */}
        {multiUserEnabled ? (
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-gold-500" />
              <h4 className="section-eyebrow">Add Employee</h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create a login for a staff member. They'll only be able to make sales and view stock.
            </p>
            <form onSubmit={handleCreateEmployee} className="space-y-3">
              <div>
                <label className="label-field">Full Name</label>
                <input
                  required
                  value={employeeForm.fullName}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, fullName: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Mwansa Banda"
                />
              </div>
              <div>
                <label className="label-field">Email (used to log in)</label>
                <input
                  type="email"
                  required
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                  className="input-field"
                  placeholder="staff@yourbusiness.com"
                />
              </div>
              <div>
                <label className="label-field">Temporary Password</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={employeeForm.password}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                  className="input-field"
                  placeholder="At least 6 characters"
                />
              </div>

              {employeeStatus && (
                <p className={`text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2 ${
                  employeeStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                }`}>
                  {employeeStatus.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {employeeStatus.message}
                </p>
              )}

              <button type="submit" disabled={creatingEmployee} className="btn-gold w-full py-3 rounded-xl font-bold disabled:opacity-60">
                {creatingEmployee ? 'Creating account…' : 'Create Employee Account'}
              </button>
            </form>
          </div>
        ) : (
          <UpgradePrompt feature="Adding staff accounts" requiredPlan="business_plus" />
        )}
      </div>
    </div>
  );
}
