import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import Footer from '../components/Footer';

export default function Login() {
  const { session, signIn, loading, role } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    const destination = role === 'employee' ? '/pos' : role === 'platform_admin' ? '/admin/approvals' : '/dashboard';
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) setError(error.message || 'Could not sign in. Check your details and try again.');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-midnight-950 px-4">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-8 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <BrandMark size={64} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome back</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sign in to your Vyeta Business Hub</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
              className="input-field"
            />
          </div>
          <div className="flex justify-between items-center">
            <label className="label-field mb-0">Password</label>
            <Link to="/forgot-password" className="text-[11px] font-bold text-gold-600 dark:text-gold-400">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input-field"
          />

          {error && <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-gold w-full py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
            <LogIn className="w-4 h-4" />
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-6">
          New business?{' '}
          <Link to="/signup" className="font-bold text-gold-600 dark:text-gold-400">
            Create an account
          </Link>
          . Employees are added by their Manager from inside the app.
        </p>
      </div>
      <Footer />
    </div>
  );
}
