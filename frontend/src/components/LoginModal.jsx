import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth, DEMO_USERS } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, UserCheck } from 'lucide-react';

export default function LoginModal() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle standard credential submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    setError('');

    const res = await login(email.trim(), password);
    if (!res.success) {
      setError(t.invalidCredentials);
    }
    setIsLoading(false);
  };

  // Quick demo login
  const handleQuickLogin = (demo) => {
    login(demo.email, 'password123');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-light-bg dark:bg-dark-bg select-none">
      <div className="w-full max-w-md bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl shadow-xl p-6 space-y-6">
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-light-accent dark:bg-dark-accent items-center justify-center font-black text-black text-2xl shadow-md">
            R
          </div>
          <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
            {t.loginTitle}
          </h2>
          <p className="text-xs text-light-muted dark:text-dark-muted">
            {t.loginSubtitle}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">
              {t.emailLabel}
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-3 text-light-muted dark:text-dark-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@riwi.io"
                required
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">
              {t.passwordLabel}
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-3 text-light-muted dark:text-dark-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-light-accent dark:bg-dark-accent text-white dark:text-black font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <span>{isLoading ? t.loggingInBtn : t.loginBtn}</span>
            {!isLoading && <ArrowRight size={14} />}
          </button>
        </form>

        {/* Demo Accounts List */}
        <div className="pt-2 border-t border-light-border dark:border-dark-border space-y-2">
          <div className="text-[11px] font-bold text-light-muted dark:text-dark-muted uppercase tracking-wider text-center">
            {t.demoUsersTitle}
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.id}
                type="button"
                onClick={() => handleQuickLogin(demo)}
                className="text-left px-3 py-1.5 rounded-lg bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text dark:text-dark-text hover:border-light-accent dark:hover:border-dark-accent hover:text-light-accent dark:hover:text-dark-accent text-xs flex items-center justify-between transition-colors"
              >
                <span className="font-semibold truncate">{demo.name}</span>
                <span className="text-[10px] text-light-muted dark:text-dark-muted uppercase">{demo.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
