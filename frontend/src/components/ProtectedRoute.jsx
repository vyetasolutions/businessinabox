import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';

/**
 * Wrap any page that requires a logged-in user. Pass `allow={['manager']}`
 * to also restrict by role — Employees hitting a Manager-only route are
 * bounced to their own dashboard instead of seeing a broken page.
 */
export default function ProtectedRoute({ children, allow }) {
  const { session, role, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!session) return <Navigate to="/login" replace />;

  if (allow && !allow.includes(role)) {
    const fallback = role === 'employee' ? '/pos' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return children;
}
