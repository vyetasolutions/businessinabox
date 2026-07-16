import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Footer from '../components/Footer';

export default function SubscriptionRequired() {
  const { organization, signOut } = useAuth();
  const trialExpired = organization?.subscription_status === 'trialing';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-midnight-950 px-4">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-8 text-center space-y-4 animate-fade-in">
        <div className="w-14 h-14 bg-gold-500/10 text-gold-500 rounded-full flex items-center justify-center mx-auto">
          <CreditCard className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {trialExpired ? 'Your free trial has ended' : 'Subscription needed'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {trialExpired
            ? `${organization?.name || 'Your business'}'s 14-day trial has ended. Choose a plan to keep using Vyeta Business Hub.`
            : `${organization?.name || 'Your business'}'s subscription isn't active. Renew to regain access.`}
        </p>
        <Link to="/billing" className="btn-gold w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2">
          <CreditCard className="w-4 h-4" /> View Plans & Pay
        </Link>
        <button onClick={signOut} className="btn-ghost w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
      <Footer />
    </div>
  );
}
