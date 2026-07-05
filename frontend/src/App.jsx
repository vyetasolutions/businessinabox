import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SunMoon, WifiOff } from 'lucide-react';
import LoadingScreen from './components/LoadingScreen';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import DocumentGenerator from './pages/DocumentGenerator';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import EmployeePos from './pages/EmployeePos';
import { useAuth } from './context/AuthContext';
import { initOfflineSyncListener } from './lib/offlineSync';

function AppShell({ children, title, breadcrumb }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('vyeta_theme') || 'light');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('vyeta_theme', theme);
  }, [theme]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-midnight-950 text-slate-900 dark:text-slate-100 pb-24 md:pb-0 md:pl-64 transition-colors">
      <Sidebar theme={theme} onToggleTheme={toggleTheme} isOnline={isOnline} />

      <header className="w-full glass-nav border-b sticky top-0 backdrop-blur-md z-40 px-4 sm:px-6 md:px-10 py-3 flex justify-between items-center">
        <div>
          <span className="text-[11px] font-bold tracking-wider text-gold-600 dark:text-gold-400 uppercase">{breadcrumb}</span>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white -mt-0.5">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Powered by</span>
            <span className="text-[11px] font-bold tracking-tight text-gold-600 dark:text-gold-400">Vyeta</span>
          </div>
          <button onClick={toggleTheme} className="md:hidden p-2.5 rounded-xl glass-panel">
            <SunMoon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    // Keep the premium boot animation on screen briefly even on fast connections —
    // this is an intentional brand moment, not just a spinner.
    const t = setTimeout(() => setBootDone(true), 1100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const cleanup = initOfflineSyncListener();
    return cleanup;
  }, []);

  if (loading || !bootDone) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allow={['manager', 'platform_admin']}>
            <AppShell title="Welcome Back" breadcrumb="Overview">
              <ManagerDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/generator"
        element={
          <ProtectedRoute allow={['manager', 'platform_admin']}>
            <AppShell title="New Document" breadcrumb="Create">
              <DocumentGenerator />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory"
        element={
          <ProtectedRoute allow={['manager', 'platform_admin', 'employee']}>
            <AppShell title="Stock Inventory" breadcrumb="Stock">
              <Inventory />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/customers"
        element={
          <ProtectedRoute allow={['manager', 'platform_admin', 'employee']}>
            <AppShell title="Customers" breadcrumb="People">
              <Customers />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute allow={['manager', 'platform_admin']}>
            <AppShell title="Business Profile" breadcrumb="Settings">
              <Settings />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pos"
        element={
          <ProtectedRoute allow={['employee']}>
            <AppShell title="Point of Sale" breadcrumb="Sell">
              <EmployeePos />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
