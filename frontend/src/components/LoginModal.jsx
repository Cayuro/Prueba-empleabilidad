import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, ArrowRight, Info, CheckCircle2 } from 'lucide-react';

export default function LoginModal() {
  const { t } = useLanguage();
  const { login, register } = useAuth();
  
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle standard credential submit against Spring Boot backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (mode === 'register' && !name.trim()) return;

    setIsLoading(true);
    setError('');

    let res;
    if (mode === 'login') {
      res = await login(email.trim(), password);
    } else {
      res = await register(name.trim(), email.trim(), password);
    }

    if (!res.success) {
      setError(res.error || t.invalidCredentials);
    }
    setIsLoading(false);
  };

  // Helper to fill credentials for testing
  const fillCredentials = (userEmail, userPass) => {
    setMode('login');
    setEmail(userEmail);
    setPassword(userPass);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-light-bg dark:bg-dark-bg select-none transition-colors duration-200">
      <div className="w-full max-w-md bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl shadow-2xl p-6 space-y-5">
        {/* Riwi Brand Logo: White background with Riwi Purple #6b5cff */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-white border border-neutral-200 items-center justify-center font-black text-[#6b5cff] text-3xl shadow-lg ring-4 ring-[#6b5cff]/10">
            R
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-light-text dark:text-dark-text">
              {mode === 'login' ? t.loginTitle : t.registerTitle}
            </h2>
            <p className="text-xs text-light-muted dark:text-dark-muted mt-0.5">
              {mode === 'login' ? t.loginSubtitle : t.registerSubtitle}
            </p>
          </div>
        </div>

        {/* Auth Mode Tabs: Login vs Register */}
        <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-900 p-1 border border-light-border dark:border-dark-border">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text shadow-sm'
                : 'text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            {t.tabLogin}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text shadow-sm'
                : 'text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            {t.tabRegister}
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold text-center">
              {error}
            </div>
          )}

          {/* Full Name field (Register only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">
                {t.nameLabel}
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-2.5 text-light-muted dark:text-dark-muted" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  required
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent transition-colors"
                />
              </div>
            </div>
          )}

          {/* Email field */}
          <div>
            <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">
              {t.emailLabel}
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-2.5 text-light-muted dark:text-dark-muted" />
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

          {/* Password field */}
          <div>
            <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">
              {t.passwordLabel}
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-2.5 text-light-muted dark:text-dark-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-light-accent dark:bg-dark-accent text-white dark:text-black font-extrabold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center space-x-2 shadow-md cursor-pointer"
          >
            <span>
              {isLoading
                ? (mode === 'login' ? t.loggingInBtn : t.registeringBtn)
                : (mode === 'login' ? t.loginBtn : t.registerBtn)}
            </span>
            {!isLoading && <ArrowRight size={14} />}
          </button>
        </form>

        {/* Demo Credentials Guide Helper */}
        <div className="pt-2.5 border-t border-light-border dark:border-dark-border space-y-1.5">
          <div className="flex items-center space-x-1 text-[10px] font-bold text-light-muted dark:text-dark-muted">
            <Info size={12} className="text-[#6b5cff]" />
            <span>Credenciales de prueba disponibles:</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => fillCredentials('admin@riwi.io', 'RiwiAdmin2026!')}
              className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border hover:border-[#6b5cff] text-left transition-colors cursor-pointer"
            >
              <div className="font-bold text-light-text dark:text-dark-text text-[11px]">Carlos (Admin)</div>
              <div className="text-[10px] text-light-muted dark:text-dark-muted truncate">admin@riwi.io</div>
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('valeria.dev@riwi.io', 'RiwiDev2026!')}
              className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border hover:border-[#6b5cff] text-left transition-colors cursor-pointer"
            >
              <div className="font-bold text-light-text dark:text-dark-text text-[11px]">Valeria (Dev)</div>
              <div className="text-[10px] text-light-muted dark:text-dark-muted truncate">valeria.dev@riwi.io</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
