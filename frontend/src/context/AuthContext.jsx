import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfileAndOrg = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setOrganization(null);
      return;
    }
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, organization_id, full_name, role, is_active')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Failed to load profile:', profileError.message);
      setProfile(null);
      setOrganization(null);
      return;
    }
    setProfile(profileData);

    if (profileData?.organization_id) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profileData.organization_id)
        .single();
      setOrganization(orgData || null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) await loadProfileAndOrg(session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await loadProfileAndOrg(newSession.user.id);
      } else {
        setProfile(null);
        setOrganization(null);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [loadProfileAndOrg]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    await loadProfileAndOrg(data.user.id);
    return { data };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setOrganization(null);
  };

  const refreshOrganization = useCallback(async () => {
    if (profile?.organization_id) {
      const { data } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single();
      setOrganization(data || null);
    }
  }, [profile]);

  const value = {
    session,
    user: session?.user || null,
    profile,
    organization,
    role: profile?.role || null,
    isManager: profile?.role === 'manager' || profile?.role === 'platform_admin',
    isEmployee: profile?.role === 'employee',
    loading,
    signIn,
    signOut,
    refreshOrganization
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
