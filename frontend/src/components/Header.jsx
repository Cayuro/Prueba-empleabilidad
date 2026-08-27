import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { wsService } from '../services/websocket';
import { Sun, Moon, Globe, MessageSquare, Bot, RefreshCw, PanelLeftClose, PanelLeft, Sparkles } from 'lucide-react';

export default function Header({
  onOpenProfile,
  showChannels,
  onToggleChannels,
  showCopilot,
  onToggleCopilot,
}) {
  const { theme, toggleTheme } = useTheme();
  const { toggleLanguage, t } = useLanguage();
  const { user, token } = useAuth();
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
    <header className="flex flex-wrap justify-between items-center px-4 py-2.5 border-b border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card shadow-sm select-none transition-colors duration-200 z-20">
      {/* Brand logo, title & Left Panels Toggle */}
      <div className="flex items-center space-x-3">
        {/* Toggle Channels List Button */}
        <button
          onClick={onToggleChannels}
          className={`p-1.5 rounded-lg border transition-colors ${
            showChannels
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'border-light-border dark:border-dark-border text-light-muted dark:text-dark-muted hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          title={showChannels ? 'Ocultar Canales' : 'Mostrar Canales'}
        >
          {showChannels ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>

        <div className="w-8 h-8 rounded-xl bg-white border border-neutral-200 flex items-center justify-center font-black text-[#6b5cff] text-lg shadow-sm ring-2 ring-[#6b5cff]/10">
          R
        </div>
        <div>
          <h1 className="text-sm sm:text-base font-black tracking-tight text-light-text dark:text-dark-text leading-tight">
            {t.appTitle}
          </h1>
          <p className="text-[10px] text-light-muted dark:text-dark-muted hidden md:block">
            {t.appSubtitle}
          </p>
        </div>
      </div>

      {/* Right controls: Copilot toggle, WS status, Lang, Theme, Profile */}
      <div className="flex items-center space-x-2 sm:space-x-2.5 mt-1 sm:mt-0">
        {/* Toggle Copilot AI Panel Button */}
        <button
          onClick={onToggleCopilot}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
            showCopilot
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500 shadow-sm shadow-purple-500/20'
              : 'border-light-border dark:border-dark-border text-light-muted dark:text-dark-muted hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          title={showCopilot ? 'Ocultar Copiloto IA' : 'Mostrar Copiloto IA'}
        >
          <Sparkles size={14} className={showCopilot ? 'text-amber-300' : ''} />
          <span className="hidden sm:inline">Copiloto IA</span>
        </button>

        {/* Real-time connection badge */}
        <div 
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 border border-light-border dark:border-dark-border"
          title={statusInfo.text}
        >
          <span className={`w-2 h-2 rounded-full ${statusInfo.color}`} />
          <span className="text-light-muted dark:text-dark-muted text-xs hidden lg:inline">
            {statusInfo.text}
          </span>
          {wsStatus !== 'CONNECTED' && (
            <button 
              onClick={() => token && wsService.connect(token)}
              className="text-light-accent dark:text-dark-accent hover:opacity-80 ml-0.5"
              title={t.reconnect}
            >
              <RefreshCw size={11} />
            </button>
          )}
        </div>

        {/* Language switch button */}
        <button
          onClick={toggleLanguage}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-light-border dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-light-text dark:text-dark-text transition-colors"
          title={t.langToggle}
        >
          <Globe size={13} className="text-light-accent dark:text-dark-accent" />
          <span>{t.langToggle}</span>
        </button>

        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-light-accent dark:bg-dark-accent text-white dark:text-black hover:opacity-90 transition-opacity shadow-sm"
          title={t.themeToggle}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={13} />
              <span className="hidden sm:inline">{t.themeLight}</span>
            </>
          ) : (
            <>
              <Moon size={13} />
              <span className="hidden sm:inline">{t.themeDark}</span>
            </>
          )}
        </button>

        {/* User profile toggle button */}
        {user && (
          <button
            onClick={onOpenProfile}
            className="flex items-center space-x-1.5 pl-1.5 pr-2.5 py-1 rounded-lg border border-light-border dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
              {user.name.charAt(0)}
            </div>
            <span className="text-xs font-semibold text-light-text dark:text-dark-text max-w-[80px] truncate hidden sm:inline">
              {user.name.split(' ')[0]}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
