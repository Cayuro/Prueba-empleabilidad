import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth, DEMO_USERS } from '../context/AuthContext';
import { Lock, Mail, User, ArrowRight, Info, Users, Shield, Check } from 'lucide-react';

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

  // Quick 1-click login for demo users
  const handleQuickLogin = async (demoEmail, demoPass) => {
    setIsLoading(true);
    setError('');
    setEmail(demoEmail);
    setPassword(demoPass);
    const res = await login(demoEmail, demoPass);
    if (!res.success) {
      setError(res.error || t.invalidCredentials);
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-light-bg dark:bg-dark-bg select-none transition-colors duration-200 overflow-y-auto">
      <div className="w-full max-w-lg bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl shadow-2xl p-5 space-y-4 my-8">
        {/* Riwi Brand Logo: White background with Riwi Purple #6b5cff */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-white border border-neutral-200 items-center justify-center font-black text-[#6b5cff] text-2xl shadow-lg ring-4 ring-[#6b5cff]/10">
            R
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-light-text dark:text-dark-text">
              {mode === 'login' ? t.loginTitle : t.registerTitle}
            </h2>
            <p className="text-xs text-light-muted dark:text-dark-muted">
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
            className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
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
            className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text shadow-sm'
                : 'text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            {t.tabRegister}
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold text-center">
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
                <User size={14} className="absolute left-3 top-2.5 text-light-muted dark:text-dark-muted" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  required
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
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
              <Mail size={14} className="absolute left-3 top-2.5 text-light-muted dark:text-dark-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@riwi.io"
                required
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">
              {t.passwordLabel}
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-2.5 text-light-muted dark:text-dark-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 rounded-lg bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black font-extrabold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center space-x-2 shadow-md cursor-pointer"
          >
            <span>
              {isLoading
                ? (mode === 'login' ? t.loggingInBtn : t.registeringBtn)
                : (mode === 'login' ? t.loginBtn : t.registerBtn)}
            </span>
            {!isLoading && <ArrowRight size={14} />}
          </button>
        </form>

        {/* 10 Demo Users Fast Selector */}
        <div className="pt-3 border-t border-light-border dark:border-dark-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-light-text dark:text-dark-text">
              <Users size={14} className="text-emerald-500" />
              <span>Selecciona un usuario de prueba (10 Cuentas):</span>
            </div>
            <span className="text-[10px] text-light-muted dark:text-dark-muted">Click para ingresar</span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 pr-1 divide-y divide-light-border/40 dark:divide-dark-border/40 border border-light-border/60 dark:border-dark-border/60 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/50 p-1">
            {DEMO_USERS.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleQuickLogin(u.email, u.password)}
                className="w-full p-2 text-left rounded-lg hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-light-text dark:text-dark-text group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                      {u.name}
                    </span>
                    <span className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded uppercase ${
                      u.role === 'admin'
                        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                    }`}>
                      {u.role}
                    </span>
                  </div>
                  <div className="text-[10px] text-light-muted dark:text-dark-muted truncate">
                    {u.email} • <span className="text-neutral-500 dark:text-neutral-400">{u.description}</span>
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight size={12} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
