import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { BACKEND_URL } from '../lib/supabaseClient';
import BrandMark from '../components/BrandMark';
import Footer from '../components/Footer';

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ businessName: '', phone: '', fullName: '', email: '', password: '' });
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/signup-business`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
      } else {
        setError(data.error || 'Could not create your account. Please try again.');
      }
    } catch (err) {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-midnight-950 px-4">
        <div className="w-full max-w-sm glass-panel rounded-3xl p-8 text-center space-y-4 animate-fade-in">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">You're almost in!</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your account has been created. Your business is now pending a quick review — you'll be able to sign in and start using
            the platform as soon as it's approved.
          </p>
          <Link to="/login" className="btn-gold w-full py-3 rounded-xl font-bold inline-block">
            Go to Sign In
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-midnight-950 px-4 py-10">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-8 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <BrandMark size={64} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Register your business</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
            Set up your Vyeta Business Hub account in a couple of minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Business Name</label>
            <input required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="e.g., Acme Traders" className="input-field" />
          </div>
          <div>
            <label className="label-field">Business Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="097xxxxxxx" className="input-field" />
          </div>
          <div>
            <label className="label-field">Your Full Name</label>
            <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g., Suwilanji Phiri" className="input-field" />
          </div>
          <div>
            <label className="label-field">Your Email</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@business.com" className="input-field" />
          </div>
          <div>
            <label className="label-field">Password</label>
            <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" className="input-field" />
          </div>

          {error && <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}

          <label className="flex items-start gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-gold-500 w-3.5 h-3.5 shrink-0"
            />
            <span>
              I agree to the{' '}
              <Link to="/privacy-policy" target="_blank" className="font-bold text-gold-600 dark:text-gold-400 underline">
                Privacy Policy
              </Link>{' '}
              and consent to my business and customer data being processed as described.
            </span>
          </label>

          <button type="submit" disabled={submitting || !agreed} className="btn-gold w-full py-3.5 rounded-xl font-bold disabled:opacity-60">
            {submitting ? 'Creating your account…' : 'Create Business Account'}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-6">
          Already have an account? <Link to="/login" className="font-bold text-gold-600 dark:text-gold-400">Sign in</Link>
        </p>
      </div>
      <Footer />
    </div>
  );
}
