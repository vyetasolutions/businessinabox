import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Building2 } from 'lucide-react';
import { supabase, BACKEND_URL } from '../lib/supabaseClient';

export default function AdminApprovals() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState(null);

  const authedFetch = async (path, options = {}) => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    return fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
        ...(options.headers || {})
      }
    });
  };

  const loadPending = async () => {
    setLoading(true);
    try {
      const res = await authedFetch('/api/admin/pending-organizations');
      const data = await res.json();
      if (data.success) setOrgs(data.organizations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleDecision = async (organizationId, approve) => {
    setActingOn(organizationId);
    try {
      const res = await authedFetch('/api/admin/approve-organization', {
        method: 'POST',
        body: JSON.stringify({ organizationId, approve })
      });
      const data = await res.json();
      if (data.success) {
        setOrgs((prev) => prev.filter((o) => o.id !== organizationId));
      } else {
        alert(data.error || 'Could not update this business.');
      }
    } catch (err) {
      alert('Could not reach the server. Try again.');
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-gold-500" />
        <h4 className="section-eyebrow">Pending Business Approvals</h4>
      </div>

      <div className="glass-panel rounded-2xl divide-y divide-slate-200 dark:divide-white/10">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : orgs.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">No businesses waiting for approval right now.</p>
        ) : (
          orgs.map((org) => (
            <div key={org.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">{org.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manager: {org.managerName} {org.managerEmail ? `· ${org.managerEmail}` : ''}
                </p>
                {org.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{org.phone}</p>}
                <p className="text-[11px] text-slate-400 mt-1">Signed up {new Date(org.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleDecision(org.id, true)}
                  disabled={actingOn === org.id}
                  className="btn-gold px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  onClick={() => handleDecision(org.id, false)}
                  disabled={actingOn === org.id}
                  className="btn-ghost px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-rose-500 disabled:opacity-60"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
