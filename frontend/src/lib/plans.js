// Mirrors the feature matrix enforced in supabase_migration_004_plans_billing.sql
// (see the public.plan_allows() function). If you change pricing or features,
// change both places.

export const PLANS = {
  starter: {
    key: 'starter',
    label: 'Starter',
    price: 149,
    tagline: 'Perfect for sole traders and small businesses',
    features: ['Quotations', 'Invoices', 'Receipts', 'Customer database', 'Sales tracking'],
    docTypes: ['Invoice', 'Quotation', 'Receipt']
  },
  professional: {
    key: 'professional',
    label: 'Professional',
    price: 299,
    tagline: 'Recommended for growing SMEs',
    features: ['Everything in Starter', 'Expense tracking', 'Inventory management', 'Reports', 'Business dashboard'],
    docTypes: ['Invoice', 'Quotation', 'Receipt', 'Delivery Note']
  },
  business_plus: {
    key: 'business_plus',
    label: 'Business Plus',
    price: 599,
    tagline: 'Recommended for established businesses',
    features: ['Everything in Professional', 'Multi-user access', 'Multiple branches', 'Advanced reporting', 'Priority support', 'Custom branding'],
    docTypes: ['Invoice', 'Quotation', 'Receipt', 'Delivery Note']
  }
};

export const PLAN_ORDER = ['starter', 'professional', 'business_plus'];

/**
 * Always returns a valid plan config, even if the organization somehow has
 * an unrecognized value in `plan` (e.g. stale data, a migration hiccup).
 * Never index PLANS[...] directly with a value that came from the database —
 * use this instead, so a bad value degrades to Starter's display rather than
 * crashing the whole page.
 */
export function getPlanConfig(planKey) {
  return PLANS[planKey] || PLANS.starter;
}

/**
 * Client-side mirror of the database's plan_allows() function — used only to
 * decide what the UI shows/hides. The real enforcement lives in Postgres RLS
 * and the backend; this just avoids showing a Manager a button that would
 * fail anyway.
 */
export function planAllows(organization, feature) {
  const plan = organization?.plan || 'starter';
  switch (feature) {
    case 'inventory':
    case 'delivery_note':
    case 'expense_tracking':
    case 'reports':
      return plan === 'professional' || plan === 'business_plus';
    case 'multi_user':
    case 'multi_branch':
    case 'custom_branding':
      return plan === 'business_plus';
    default:
      return false;
  }
}

export function isTrialExpired(organization) {
  if (!organization) return false;
  if (organization.subscription_status !== 'trialing') return false;
  if (!organization.trial_ends_at) return false;
  return new Date(organization.trial_ends_at) < new Date();
}

export function daysLeftInTrial(organization) {
  if (!organization?.trial_ends_at) return 0;
  const ms = new Date(organization.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
