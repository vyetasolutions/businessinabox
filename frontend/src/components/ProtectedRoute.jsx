import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';
import PendingApproval from '../pages/PendingApproval';

/**
 * Wrap any page that requires a logged-in user. Pass `allow={['manager']}`
 * to also restrict by role — Employees hitting a Manager-only route are
 * bounced to their own dashboard instead of seeing a broken page.
 *
 * Also enforces the organization approval gate: Managers/Employees of a
 * 'pending' or 'suspended' business see a holding screen instead of the
 * page they asked for. Platform Admins are exempt (see it as a
 * business rule, not a technicality: they run the platform).
 */
export default function ProtectedRoute({ children, allow }) {
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

  return children;
}
