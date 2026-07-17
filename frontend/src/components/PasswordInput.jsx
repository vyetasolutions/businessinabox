import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Drop-in replacement for <input type="password">, with a show/hide eye
 * toggle. Accepts all the same props (value, onChange, required, minLength,
 * placeholder, etc.) and forwards them to the underlying input.
 */
export default function PasswordInput({ className = 'input-field', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input type={visible ? 'text' : 'password'} className={`${className} !pr-11`} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
