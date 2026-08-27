import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { wsService } from '../services/websocket';
import { Sun, Moon, Globe, User, Radio, RefreshCw } from 'lucide-react';

export default function Header({ onOpenProfile }) {
  const { theme, toggleTheme } = useTheme();
  const { toggleLanguage, t } = useLanguage();
  const { user } = useAuth();
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');

  // Track real-time WebSocket connection state
  useEffect(() => {
    const unsubscribe = wsService.onStatusChange((status) => {
      setWsStatus(status);
    });
    return () => unsubscribe();
  }, []);

  // Connection indicator status color and label
  const getStatusBadge = () => {
    switch (wsStatus) {
      case 'CONNECTED':
        return { color: 'bg-emerald-500', text: t.statusConnected };
      case 'CONNECTING':
        return { color: 'bg-amber-500 animate-pulse', text: t.statusConnecting };
      case 'ERROR':
        return { color: 'bg-red-500', text: t.statusError };
      default:
        return { color: 'bg-neutral-500', text: t.statusDisconnected };
    }
  };

  const statusInfo = getStatusBadge();

  return (
    <header className="flex flex-wrap justify-between items-center px-4 py-3 border-b border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card shadow-sm select-none transition-colors duration-200">
      {/* Brand logo & title */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-light-accent dark:bg-dark-accent flex items-center justify-center font-black text-black text-xl shadow-inner">
          R
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-light-text dark:text-dark-text leading-tight">
            {t.appTitle}
          </h1>
          <p className="text-xs text-light-muted dark:text-dark-muted hidden sm:block">
            {t.appSubtitle}
          </p>
        </div>
      </div>

      {/* Right controls: WS status, Lang, Theme, Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3 mt-2 sm:mt-0">
        {/* Real-time connection badge */}
        <div 
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 border border-light-border dark:border-dark-border"
          title={statusInfo.text}
        >
          <span className={`w-2 h-2 rounded-full ${statusInfo.color}`} />
          <span className="text-light-muted dark:text-dark-muted text-xs hidden md:inline">
            {statusInfo.text}
          </span>
          {wsStatus !== 'CONNECTED' && (
            <button 
              onClick={() => wsService.connect()}
              className="text-light-accent dark:text-dark-accent hover:opacity-80 ml-1"
              title={t.reconnect}
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>

        {/* Language switch button */}
        <button
          onClick={toggleLanguage}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold border border-light-border dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-light-text dark:text-dark-text transition-colors"
          title={t.langToggle}
        >
          <Globe size={14} className="text-light-accent dark:text-dark-accent" />
          <span>{t.langToggle}</span>
        </button>

        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-bold bg-light-accent dark:bg-dark-accent text-white dark:text-black hover:opacity-90 transition-opacity shadow-sm"
          title={t.themeToggle}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={14} />
              <span>{t.themeLight}</span>
            </>
          ) : (
            <>
              <Moon size={14} />
              <span>{t.themeDark}</span>
            </>
          )}
        </button>

        {/* User profile toggle button */}
        {user && (
          <button
            onClick={onOpenProfile}
            className="flex items-center space-x-2 pl-2 pr-3 py-1 rounded-md border border-light-border dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent font-bold text-xs flex items-center justify-center">
              {user.name.charAt(0)}
            </div>
            <span className="text-xs font-medium text-light-text dark:text-dark-text max-w-[90px] truncate hidden sm:inline">
              {user.name}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
