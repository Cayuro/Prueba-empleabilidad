import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth, DEMO_USERS } from '../context/AuthContext';
import { User, Shield, LogOut, X, RefreshCw, Cpu } from 'lucide-react';

export default function UserProfileModal({ isOpen, onClose, usageStats }) {
  const { t } = useLanguage();
  const { user, logout, switchUser } = useAuth();

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-2">
            <User size={18} className="text-light-accent dark:text-dark-accent" />
            <h3 className="text-sm font-bold text-light-text dark:text-dark-text">
              {t.userProfileTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-light-muted dark:text-dark-muted hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Info Details */}
        <div className="p-4 space-y-4">
          <div className="flex items-center space-x-3.5 p-3 rounded-lg bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
            <div className="w-12 h-12 rounded-full bg-light-accent dark:bg-dark-accent text-white dark:text-black font-extrabold text-lg flex items-center justify-center shadow-inner">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-light-text dark:text-dark-text truncate">
                {user.name}
              </h4>
              <p className="text-xs text-light-muted dark:text-dark-muted truncate">
                {user.email}
              </p>
              <div className="mt-1 flex items-center space-x-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-light-accent/15 dark:bg-dark-accent/15 text-light-accent dark:text-dark-accent uppercase">
                  {user.role === 'admin' ? t.roleAdmin : t.roleMember}
                </span>
                <span className="text-[10px] text-emerald-500 font-medium">● {t.sessionActive}</span>
              </div>
            </div>
          </div>

          {/* Usage Metrics for Copilot */}
          {usageStats && (
            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-light-border dark:border-dark-border space-y-1.5">
              <div className="text-xs font-bold text-light-text dark:text-dark-text flex items-center space-x-1.5">
                <Cpu size={14} className="text-light-accent dark:text-dark-accent" />
                <span>{t.copilotUsageStats}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="bg-light-card dark:bg-dark-card p-2 rounded border border-light-border/60 dark:border-dark-border/60">
                  <div className="text-light-muted dark:text-dark-muted text-[10px]">{t.copilotTotalQueries}</div>
                  <div className="text-sm font-bold text-light-text dark:text-dark-text">{usageStats.total_queries || 0}</div>
                </div>
                <div className="bg-light-card dark:bg-dark-card p-2 rounded border border-light-border/60 dark:border-dark-border/60">
                  <div className="text-light-muted dark:text-dark-muted text-[10px]">{t.copilotTotalTokens}</div>
                  <div className="text-sm font-bold text-light-accent dark:text-dark-accent">{usageStats.total_tokens || 0}</div>
                </div>
              </div>
            </div>
          )}

          {/* Session Security Note */}
          <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-xs text-light-muted dark:text-dark-muted flex items-start space-x-2">
            <Shield size={16} className="text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold text-light-text dark:text-dark-text">Sesión protegida con JWT (15 min)</div>
              <div className="text-[11px] mt-0.5">La autorización y aislamiento de canales se valida en cada consulta directamente en PostgreSQL mediante Row Level Security (RLS).</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-900 border-t border-light-border dark:border-dark-border">
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={14} />
            <span>{t.logoutBtn}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-semibold bg-neutral-200 dark:bg-neutral-800 text-light-text dark:text-dark-text hover:opacity-80 transition-opacity"
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
