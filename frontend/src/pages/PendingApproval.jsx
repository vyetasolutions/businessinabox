import React from 'react';
import { Hourglass, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PendingApproval() {
  const { organization, signOut } = useAuth();
  const suspended = organization?.status === 'suspended';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-midnight-950 px-4">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-8 text-center space-y-4 animate-fade-in">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${suspended ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
          {suspended ? <ShieldAlert className="w-7 h-7" /> : <Hourglass className="w-7 h-7" />}
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {suspended ? 'Access Suspended' : 'Pending Approval'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {suspended
            ? `${organization?.name || 'Your business'} currently has restricted access. Please contact Vyeta Digital Solutions for help.`
            : `${organization?.name || 'Your business'} is being reviewed. You'll be able to use the platform as soon as it's approved — no action needed from you.`}
        </p>
        <button onClick={signOut} className="btn-ghost w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}
