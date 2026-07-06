import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import Footer from '../components/Footer';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setSubmitting(false);
    if (error) {
      setError(error.message || 'Could not send reset email. Please try again.');
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-midnight-950 px-4">
        <div className="w-full max-w-sm glass-panel rounded-3xl p-8 text-center space-y-4 animate-fade-in">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Check your email</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            If an account exists for <span className="font-semibold">{email}</span>, a password reset link is on its way.
          </p>
          <Link to="/login" className="btn-ghost w-full py-3 rounded-xl font-bold text-sm inline-block">
            Back to Sign In
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-midnight-950 px-4">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-8 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-300 to-gold-600 flex items-center justify-center text-midnight-950 mb-4 shadow-gold">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Reset your password</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
            Enter your email and we'll send you a link to set a new password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" className="input-field" />
          </div>

          {error && <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-gold w-full py-3.5 rounded-xl font-bold disabled:opacity-60">
            {submitting ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-6">
          <Link to="/login" className="font-bold text-gold-600 dark:text-gold-400">Back to Sign In</Link>
        </p>
      </div>
      <Footer />
    </div>
  );
}
