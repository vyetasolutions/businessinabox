import React, { useEffect, useState } from 'react';
import { CreditCard, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { supabase, BACKEND_URL } from '../lib/supabaseClient';
import { getPlanConfig, hasActiveAccess, daysLeftInTrial } from '../lib/plans';

const STATUS_BADGE = {
  trialing: { label: 'Trialing', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-500' },
  past_due: { label: 'Past Due', className: 'bg-rose-500/10 text-rose-500' },
  canceled: { label: 'Canceled', className: 'bg-slate-500/10 text-slate-500' }
};

export default function AdminBilling() {
  const [orgs, setOrgs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('organizations');

  const authedFetch = async (path) => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    return fetch(`${BACKEND_URL}${path}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [orgsRes, paymentsRes] = await Promise.all([
          authedFetch('/api/admin/organizations'),
          authedFetch('/api/admin/subscription-payments')
        ]);
        const orgsData = await orgsRes.json();
        const paymentsData = await paymentsRes.json();
        if (orgsData.success) setOrgs(orgsData.organizations);
        if (paymentsData.success) setPayments(paymentsData.payments);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeCount = orgs.filter((o) => hasActiveAccess(o)).length;
  const trialingCount = orgs.filter((o) => o.subscription_status === 'trialing').length;
  const lapsedCount = orgs.filter((o) => !hasActiveAccess(o)).length;
  const mrr = orgs
    .filter((o) => o.subscription_status === 'active' && hasActiveAccess(o))
    .reduce((sum, o) => sum + getPlanConfig(o.plan).price, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl">
          <span className="section-eyebrow">Est. Monthly Revenue</span>
          <h3 className="stat-value">K {mrr.toLocaleString()}</h3>
        </div>
        <div className="glass-panel p-5 rounded-2xl">
          <span className="section-eyebrow">Paying / Active</span>
          <h3 className="stat-value">{activeCount}</h3>
        </div>
        <div className="glass-panel p-5 rounded-2xl">
          <span className="section-eyebrow">On Trial</span>
          <h3 className="stat-value">{trialingCount}</h3>
        </div>
        <div className="glass-panel p-5 rounded-2xl">
          <span className="section-eyebrow">Lapsed / Unpaid</span>
          <h3 className="stat-value text-rose-500">{lapsedCount}</h3>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('organizations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${tab === 'organizations' ? 'btn-gold' : 'btn-ghost'}`}
        >
          Businesses
        </button>
        <button
          onClick={() => setTab('payments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${tab === 'payments' ? 'btn-gold' : 'btn-ghost'}`}
        >
          Payment History
        </button>
      </div>

      {loading ? (
        <p className="text-center text-sm text-slate-400 py-10">Loading…</p>
      ) : tab === 'organizations' ? (
        <div className="glass-panel rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/70 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-400 uppercase font-bold">
              <tr>
                <th className="px-6 py-4">Business</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Trial / Renews</th>
                <th className="px-6 py-4">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {orgs.map((org) => {
                const badge = STATUS_BADGE[org.subscription_status] || STATUS_BADGE.canceled;
                const access = hasActiveAccess(org);
                return (
                  <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{org.name}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{getPlanConfig(org.plan).label}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {org.subscription_status === 'trialing'
                        ? `${daysLeftInTrial(org)} days left`
                        : org.current_period_end
                        ? new Date(org.current_period_end).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {access ? (
                        <span className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Has access
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-500 text-xs font-bold">
                          <XCircle className="w-3.5 h-3.5" /> Locked out
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/70 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-400 uppercase font-bold">
              <tr>
                <th className="px-6 py-4">Business</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{p.organizationName}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{getPlanConfig(p.plan).label}</td>
                    <td className="px-6 py-4 font-semibold">K {Number(p.amount).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      {p.status === 'successful' ? (
                        <span className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Successful
                        </span>
                      ) : p.status === 'failed' ? (
                        <span className="flex items-center gap-1 text-rose-500 text-xs font-bold">
                          <XCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
