import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';
import PendingApproval from '../pages/PendingApproval';
import SubscriptionRequired from '../pages/SubscriptionRequired';
import { hasActiveAccess } from '../lib/plans';

/**
 * Wrap any page that requires a logged-in user. Pass `allow={['manager']}`
 * to also restrict by role — Employees hitting a Manager-only route are
 * bounced to their own dashboard instead of seeing a broken page.
 *
 * Also enforces two gates, in order:
 * 1. Organization approval ('pending'/'suspended' businesses see a holding screen).
 * 2. Subscription/trial status — a business whose trial or paid period has
 *    lapsed sees a "please subscribe" screen instead of the app, EXCEPT on
 *    the Billing page itself (pass `skipSubscriptionCheck` there), so they
 *    can still actually pay.
 *
 * Platform Admins are exempt from both — they run the platform, not a business.
 */
export default function ProtectedRoute({ children, allow, skipSubscriptionCheck = false }) {
  const { session, role, organization, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!session) return <Navigate to="/login" replace />;

  if (allow && !allow.includes(role)) {
    const fallback = role === 'employee' ? '/pos' : role === 'platform_admin' ? '/admin/approvals' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  if (role !== 'platform_admin' && organization && organization.status !== 'active') {
    return <PendingApproval />;
  }

  if (role !== 'platform_admin' && !skipSubscriptionCheck && organization && !hasActiveAccess(organization)) {
    return <SubscriptionRequired />;
  }

  return children;
}
