import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer({ variant = 'light' }) {
  const year = new Date().getFullYear();
  const textClass = variant === 'dark' ? 'text-slate-500 dark:text-slate-500' : 'text-slate-400 dark:text-slate-600';

  return (
    <footer className={`text-center text-[11px] ${textClass} py-6 px-4 space-y-1`}>
      <p>© {year} Vyeta Digital Solutions. All rights reserved.</p>
      <p>
        <Link to="/privacy-policy" className="font-semibold hover:text-gold-500 transition-colors">
          Privacy Policy
        </Link>
      </p>
    </footer>
  );
}
