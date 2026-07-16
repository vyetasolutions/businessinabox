import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus2,
  Boxes,
  Users,
  Settings as SettingsIcon,
  SunMoon,
  LogOut,
  ShoppingCart,
  WifiOff,
  ShieldCheck,
  CreditCard,
  MapPin,
  Receipt,
  BarChart3,
  MoreHorizontal,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const linkBase =
  'flex flex-col md:flex-row items-center gap-1 md:gap-3 px-2 py-2 rounded-xl text-[10px] md:text-sm font-semibold transition-all';
const linkActive = 'text-gold-600 dark:text-gold-400 bg-gold-500/10';
const linkInactive = 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5';

export default function Sidebar({ theme, onToggleTheme, isOnline }) {
  const { isManager, organization, profile, role, signOut } = useAuth();
  const [showMore, setShowMore] = useState(false);
  const location = useLocation();

  const managerLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/generator', label: 'Create Doc', icon: FilePlus2 },
    { to: '/inventory', label: 'Stock', icon: Boxes },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/expenses', label: 'Expenses', icon: Receipt },
    { to: '/branches', label: 'Branches', icon: MapPin },
    { to: '/billing', label: 'Billing', icon: CreditCard },
    { to: '/settings', label: 'Business Profile', icon: SettingsIcon }
  ];

  const employeeLinks = [
    { to: '/pos', label: 'Sell', icon: ShoppingCart },
    { to: '/inventory', label: 'Stock', icon: Boxes },
    { to: '/customers', label: 'Customers', icon: Users }
  ];

  const platformAdminLinks = [
    { to: '/admin/approvals', label: 'Approvals', icon: ShieldCheck },
    { to: '/admin/billing', label: 'Billing Overview', icon: BarChart3 }
  ];

  const allLinks = role === 'platform_admin' ? platformAdminLinks : isManager ? managerLinks : employeeLinks;

  // Mobile bottom bar only has room for ~4 tabs plus a "More" button.
  // Desktop sidebar always shows everything, so this split only matters below md.
  const MOBILE_PRIMARY_COUNT = 4;
  const mobilePrimaryLinks = allLinks.slice(0, MOBILE_PRIMARY_COUNT);
  const mobileMoreLinks = allLinks.slice(MOBILE_PRIMARY_COUNT);
  const isOnMoreLink = mobileMoreLinks.some((l) => l.to === location.pathname);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:right-auto md:w-64 md:h-screen glass-nav border-t md:border-t-0 md:border-r z-50 flex md:flex-col justify-between px-2 sm:px-6 py-2 md:py-8">
        <div className="hidden md:flex items-center gap-3 px-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-midnight-950 flex items-center justify-center shadow-gold overflow-hidden shrink-0">
            <img src="/vyeta-mark.png" alt="Vyeta" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-sm text-slate-900 dark:text-white">
              {organization?.name || 'Vyeta Business Hub'}
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-wider uppercase">
              {profile?.role === 'manager' ? 'Manager Access' : profile?.role === 'platform_admin' ? 'Platform Admin' : 'Employee Access'}
            </p>
          </div>
        </div>

        {!isOnline && (
          <div className="hidden md:flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
            <WifiOff className="w-3.5 h-3.5" /> Offline — saving locally
          </div>
        )}

        {/* Desktop: every link, full list */}
        <div className="hidden md:flex md:flex-col gap-2 w-full flex-1">
          {allLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `${linkBase} w-full ${isActive ? linkActive : linkInactive}`}>
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Mobile: top 4 links + a More button for the rest, evenly spaced, nothing clipped */}
        <div className="flex md:hidden w-full items-stretch">
          {mobilePrimaryLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `${linkBase} flex-1 ${isActive ? linkActive : linkInactive}`}>
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full">{label}</span>
            </NavLink>
          ))}
          {mobileMoreLinks.length > 0 && (
            <button
              onClick={() => setShowMore(true)}
              className={`${linkBase} flex-1 ${isOnMoreLink ? linkActive : linkInactive}`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span>More</span>
            </button>
          )}
        </div>

        <div className="hidden md:flex flex-col gap-1 w-full pt-4 border-t border-slate-200 dark:border-white/10">
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 w-full text-left transition-all"
          >
            <SunMoon className="w-5 h-5" />
            <span>Toggle Theme</span>
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-rose-500 hover:bg-rose-500/10 w-full text-left transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" sheet — everything that doesn't fit in the bottom bar */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-[60] flex items-end">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setShowMore(false)} />
          <div className="relative w-full glass-panel rounded-t-3xl p-4 pb-8 space-y-1 animate-fade-in">
            <div className="flex justify-between items-center px-2 pb-2 mb-1 border-b border-slate-200 dark:border-white/10">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">More</span>
              <button onClick={() => setShowMore(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            {mobileMoreLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setShowMore(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold w-full ${isActive ? linkActive : linkInactive}`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
