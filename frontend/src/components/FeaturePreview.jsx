import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowUpCircle } from 'lucide-react';
import { getPlanConfig } from '../lib/plans';

/**
 * Shown in place of a gated page. Unlike a plain "upgrade" message, this
 * renders a realistic (but sample/illustrative, never real business data)
 * blurred preview of what the feature looks like, with a lock overlay —
 * so the value being missed is visible, not just described. This is a
 * deliberate conversion pattern: showing the thing is more persuasive than
 * describing it.
 *
 * `mockup` is a React node — a small illustrative version of the real UI,
 * built with the same visual language (glass-panel, table rows, etc.) but
 * populated with obviously-sample data. Never fetch or display real
 * business data here — a Starter business's actual inventory/expenses
 * table is empty anyway (creation is blocked), so there's nothing real to
 * show, and it would be a bad precedent to render live data behind a
 * "blur" that a curious user could inspect via devtools.
 */
export default function FeaturePreview({ feature, requiredPlan = 'professional', mockup }) {
  const plan = getPlanConfig(requiredPlan);

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[3px] opacity-60">{mockup}</div>

      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="glass-panel rounded-2xl p-6 sm:p-8 text-center max-w-sm w-full shadow-premium space-y-3">
          <div className="w-11 h-11 bg-gold-500/10 text-gold-500 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{feature} is a {plan.label} feature</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Unlock {feature.toLowerCase()} and more for K{plan.price}/month.
          </p>
          <Link to="/billing" className="btn-gold px-5 py-2.5 rounded-xl font-bold inline-flex items-center gap-2 text-sm">
            <ArrowUpCircle className="w-4 h-4" /> Upgrade to {plan.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
