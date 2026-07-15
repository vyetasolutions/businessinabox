import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowUpCircle } from 'lucide-react';
import { PLANS } from '../lib/plans';

/**
 * Shown in place of a gated page/section. `requiredPlan` should be
 * 'professional' or 'business_plus' — whichever tier unlocks the feature.
 */
export default function UpgradePrompt({ feature, requiredPlan = 'professional' }) {
  const plan = PLANS[requiredPlan];
  return (
    <div className="glass-panel rounded-2xl p-10 text-center max-w-md mx-auto space-y-4">
      <div className="w-12 h-12 bg-gold-500/10 text-gold-500 rounded-full flex items-center justify-center mx-auto">
        <Lock className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{feature} is a {plan.label} feature</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Upgrade to {plan.label} (K{plan.price}/month) to unlock this.
        </p>
      </div>
      <Link to="/billing" className="btn-gold px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2">
        <ArrowUpCircle className="w-4 h-4" /> View Plans
      </Link>
    </div>
  );
}
