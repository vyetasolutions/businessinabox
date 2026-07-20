import React, { useState } from 'react';
import { CheckCircle2, Smartphone, Clock, ShieldCheck, Loader2, Landmark } from 'lucide-react';
import { supabase, BACKEND_URL } from '../lib/supabaseClient';
import { PLANS, PLAN_ORDER, getPlanConfig, daysLeftInTrial, isTrialExpired } from '../lib/plans';
import { useAuth } from '../context/AuthContext';

const OPERATORS = [
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'airtel', label: 'Airtel Money' },
  { value: 'zamtel', label: 'Zamtel Kwacha' }
];

const MANUAL_PAYMENT_DETAILS = {
  mobileMoney: [
    { network: 'MTN Mobile Money', number: '0760829950' },
    { network: 'Airtel Money', number: '0777363303' }
  ],
  accountName: 'Vyeta Digital Solutions'
};

export default function Billing() {
  const { organization, refreshOrganization } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [payMode, setPayMode] = useState('manual'); // 'manual' | 'lenco'
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState('mtn');
  const [manualRef, setManualRef] = useState('');
  const [stage, setStage] = useState('idle'); // idle | submitting | waiting | success | error | submitted
  const [message, setMessage] = useState('');

  const currentPlan = organization?.plan || 'starter';
  const trialActive = organization?.subscription_status === 'trialing' && !isTrialExpired(organization);
  const trialDays = daysLeftInTrial(organization);

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

  const pollStatus = async (reference, attemptsLeft = 30) => {
    if (attemptsLeft <= 0) {
      setStage('error');
      setMessage("We haven't received confirmation yet. If your payment went through, it will reflect shortly — otherwise, try again.");
      return;
    }
    try {
      const res = await authedFetch(`/api/billing/payment-status/${reference}`);
      const data = await res.json();
      if (data.success && data.status === 'successful') {
        setStage('success');
        setMessage(`You're now on the ${getPlanConfig(selectedPlan).label} plan.`);
        await refreshOrganization();
        return;
      }
      if (data.success && data.status === 'failed') {
        setStage('error');
        setMessage('The payment failed or was declined. Please try again.');
        return;
      }
    } catch (err) {
      // transient — keep polling
    }
    setTimeout(() => pollStatus(reference, attemptsLeft - 1), 3000);
  };

  const startPayment = (planKey) => {
    setSelectedPlan(planKey);
    setPayMode('manual');
    setStage('idle');
    setMessage('');
    setManualRef('');
  };

  const submitLencoPayment = async (e) => {
    e.preventDefault();
    setStage('submitting');
    setMessage('');
    try {
      const res = await authedFetch('/api/billing/initiate-payment', {
        method: 'POST',
        body: JSON.stringify({ plan: selectedPlan, phone, operator })
      });
      const data = await res.json();
      if (!data.success) {
        setStage('error');
        setMessage(data.error || 'Could not start payment.');
        return;
      }
      if (data.status === 'otp-required') {
        setStage('error');
        setMessage(
          'Your mobile money account needs extra verification that this checkout doesn\'t support yet. Please contact us to complete this payment manually.'
        );
        return;
      }
      setStage('waiting');
      setMessage('Check your phone and approve the payment prompt.');
      pollStatus(data.reference);
    } catch (err) {
      setStage('error');
      setMessage('Could not reach the payment server. Check your connection and try again.');
    }
  };

  const submitManualPayment = async (e) => {
    e.preventDefault();
    if (!manualRef.trim()) {
      setStage('error');
      setMessage('Please enter your payment reference/transaction ID.');
      return;
    }
    setStage('submitting');
    setMessage('');
    try {
      const res = await authedFetch('/api/billing/initiate-manual-payment', {
        method: 'POST',
        body: JSON.stringify({ plan: selectedPlan, manual_reference: manualRef.trim() })
      });
      const data = await res.json();
      if (!data.success) {
        setStage('error');
        setMessage(data.error || 'Could not submit payment.');
        return;
      }
      setStage('submitted');
      setMessage('Payment request submitted! Your plan will activate automatically once verified — usually within a few hours.');
    } catch (err) {
      setStage('error');
      setMessage('Could not reach the payment server. Check your connection and try again.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="glass-panel rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="section-eyebrow">Current Plan</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{getPlanConfig(currentPlan).label}</h3>
          {trialActive && (
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {trialDays} day{trialDays === 1 ? '' : 's'} left in your free trial
            </p>
          )}
          {!trialActive && organization?.subscription_status === 'active' && organization?.current_period_end && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Renews {new Date(organization.current_period_end).toLocaleDateString()}
            </p>
          )}
          {isTrialExpired(organization) && (
            <p className="text-xs font-semibold text-rose-500 mt-1">Your trial has ended — choose a plan below to continue.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLAN_ORDER.map((key) => {
          const plan = PLANS[key];
          const isCurrent = key === currentPlan && organization?.subscription_status === 'active';
          return (
            <div key={key} className={`glass-panel rounded-2xl p-6 flex flex-col ${isCurrent ? 'ring-2 ring-gold-500' : ''}`}>
              {isCurrent && (
                <span className="text-[10px] font-bold text-gold-600 dark:text-gold-400 uppercase tracking-wider mb-2">
                  Current Plan
                </span>
              )}
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.label}</h3>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                K{plan.price}
                <span className="text-sm font-medium text-slate-400">/month</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">{plan.tagline}</p>
              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startPayment(key)}
                disabled={isCurrent}
                className={`w-full py-3 rounded-xl font-bold text-sm mt-6 ${isCurrent ? 'btn-ghost opacity-60' : 'btn-gold'}`}
              >
                {isCurrent ? 'Active' : `Pay K${plan.price} for ${plan.label}`}
              </button>
            </div>
          );
        })}
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-sm w-full p-6 rounded-3xl space-y-5 animate-fade-in">
            {stage === 'success' ? (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Payment Successful</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
                <button onClick={() => setSelectedPlan(null)} className="btn-gold w-full py-3 rounded-xl font-bold">
                  Done
                </button>
              </div>
            ) : stage === 'submitted' ? (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Payment Submitted</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
                <button onClick={() => setSelectedPlan(null)} className="btn-gold w-full py-3 rounded-xl font-bold">
                  Done
                </button>
              </div>
            ) : stage === 'waiting' ? (
              <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 text-gold-500 animate-spin mx-auto" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Awaiting Approval</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Pay K{getPlanConfig(selectedPlan).price} — {getPlanConfig(selectedPlan).label}
                </h3>

                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-xl">
                  <button
                    onClick={() => { setPayMode('manual'); setStage('idle'); setMessage(''); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold ${payMode === 'manual' ? 'bg-white dark:bg-white/10 shadow' : 'text-slate-500'}`}
                  >
                    Bank / Mobile Money
                  </button>
                  <button
                    onClick={() => { setPayMode('lenco'); setStage('idle'); setMessage(''); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold ${payMode === 'lenco' ? 'bg-white dark:bg-white/10 shadow' : 'text-slate-500'}`}
                  >
                    Instant Checkout
                  </button>
                </div>

                {payMode === 'manual' ? (
                  <form onSubmit={submitManualPayment} className="space-y-4">
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 space-y-2 text-sm">
                      <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                        <Landmark className="w-4 h-4" /> Pay via mobile money or bank transfer
                      </div>
                      {MANUAL_PAYMENT_DETAILS.mobileMoney.map((m) => (
                        <p key={m.network} className="text-slate-600 dark:text-slate-300">
                          <strong>{m.network}:</strong> {m.number} ({MANUAL_PAYMENT_DETAILS.accountName})
                        </p>
                      ))}
                      <p className="text-slate-600 dark:text-slate-300">
                        <strong>Bank transfer:</strong> contact us for account details.
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">
                        Amount: K{getPlanConfig(selectedPlan).price} — then enter your transaction reference below.
                      </p>
                    </div>
                    <div>
                      <label className="label-field">Your Transaction Reference / ID</label>
                      <input
                        required
                        value={manualRef}
                        onChange={(e) => setManualRef(e.target.value)}
                        placeholder="e.g. MP250617.1234.ABC123"
                        className="input-field"
                      />
                    </div>
                    {message && stage === 'error' && (
                      <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{message}</p>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSelectedPlan(null)} className="btn-ghost flex-1 py-3 rounded-xl font-bold text-sm">
                        Cancel
                      </button>
                      <button type="submit" disabled={stage === 'submitting'} className="btn-gold flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-60">
                        {stage === 'submitting' ? 'Submitting…' : 'Submit Payment'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={submitLencoPayment} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-gold-500" />
                      <span className="text-sm text-slate-500 dark:text-slate-400">Pay instantly via mobile money checkout</span>
                    </div>
                    <div>
                      <label className="label-field">Mobile Money Network</label>
                      <select value={operator} onChange={(e) => setOperator(e.target.value)} className="input-field">
                        {OPERATORS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-field">Mobile Money Number</label>
                      <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="097xxxxxxx" className="input-field" />
                    </div>
                    {message && stage === 'error' && (
                      <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{message}</p>
                    )}
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> Payments processed securely by Lenco.
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSelectedPlan(null)} className="btn-ghost flex-1 py-3 rounded-xl font-bold text-sm">
                        Cancel
                      </button>
                      <button type="submit" disabled={stage === 'submitting'} className="btn-gold flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-60">
                        {stage === 'submitting' ? 'Starting…' : 'Pay Now'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

