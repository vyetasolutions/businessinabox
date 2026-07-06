import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import Footer from '../components/Footer';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL automatically (see
    // detectSessionInUrl: true in supabaseClient.js) and fires this event
    // once a temporary "recovery" session is established.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // In case the event already fired before this component mounted
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message || 'Could not update your password. The link may have expired — request a new one.');
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/login'), 2500);
  };

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-midnight-950 px-4">
        <div className="w-full max-w-sm glass-panel rounded-3xl p-8 text-center space-y-4 animate-fade-in">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Password updated</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Taking you to Sign In…</p>
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
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Set a new password</h1>
        </div>

        {!ready ? (
          <p className="text-sm text-center text-slate-500 dark:text-slate-400">
            Verifying your reset link… if this doesn't update in a few seconds, the link may have expired — request a new one from
            the Sign In page.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-field">New Password</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="At least 6 characters" />
            </div>
            <div>
              <label className="label-field">Confirm New Password</label>
              <input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" />
            </div>

            {error && <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-gold w-full py-3.5 rounded-xl font-bold disabled:opacity-60">
              {submitting ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
      <Footer />
    </div>
  );
}
