import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { wsService } from '../services/websocket';
import { Sun, Moon, Globe, RefreshCw, PanelLeftClose, PanelLeft, Sparkles } from 'lucide-react';

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
    <header className="flex justify-between items-center px-2.5 sm:px-4 py-2 border-b border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card shadow-xs select-none transition-colors duration-200 z-20">
      {/* Brand logo, title & Left Panels Toggle */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {/* Toggle Channels List Button */}
        <button
          onClick={onToggleChannels}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
            showChannels
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'border-light-border dark:border-dark-border text-light-muted dark:text-dark-muted hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          title={showChannels ? 'Ocultar Canales' : 'Mostrar Canales'}
        >
          {showChannels ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>

        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white border border-neutral-200 flex items-center justify-center font-black text-[#6b5cff] text-base sm:text-lg shadow-xs ring-2 ring-[#6b5cff]/10 shrink-0">
          R
        </div>
        <div className="min-w-0 truncate">
          <h1 className="text-xs sm:text-base font-black tracking-tight text-light-text dark:text-dark-text leading-tight truncate">
            {t.appTitle}
          </h1>
          <p className="text-[10px] text-light-muted dark:text-dark-muted hidden md:block">
            {t.appSubtitle}
          </p>
        </div>
      </div>

      {/* Right controls: Copilot toggle, WS status, Lang, Theme, Profile */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
        {/* Toggle Copilot AI Panel Button */}
        <button
          onClick={onToggleCopilot}
          className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
            showCopilot
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500 shadow-xs shadow-purple-500/20'
              : 'border-light-border dark:border-dark-border text-light-muted dark:text-dark-muted hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          title={showCopilot ? 'Ocultar Copiloto IA' : 'Mostrar Copiloto IA'}
        >
          <Sparkles size={13} className={showCopilot ? 'text-amber-300' : ''} />
          <span className="hidden sm:inline">Copiloto IA</span>
        </button>

        {/* Real-time connection badge */}
        <div 
          className="flex items-center space-x-1.5 px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 border border-light-border dark:border-dark-border"
          title={statusInfo.text}
        >
          <span className={`w-2 h-2 rounded-full ${statusInfo.color}`} />
          <span className="text-light-muted dark:text-dark-muted hidden lg:inline">
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
          className="flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-light-border dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-light-text dark:text-dark-text transition-colors cursor-pointer"
          title={t.langToggle}
        >
          <Globe size={13} className="text-light-accent dark:text-dark-accent" />
          <span className="hidden xs:inline">{t.langToggle}</span>
        </button>

        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-bold bg-light-accent dark:bg-dark-accent text-white dark:text-black hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
          title={t.themeToggle}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={13} />
              <span className="hidden md:inline ml-1">{t.themeLight}</span>
            </>
          ) : (
            <>
              <Moon size={13} />
              <span className="hidden md:inline ml-1">{t.themeDark}</span>
            </>
          )}
        </button>

        {/* User profile toggle button */}
        {user && (
          <button
            onClick={onOpenProfile}
            className="flex items-center space-x-1.5 p-1 sm:pl-1.5 sm:pr-2.5 sm:py-1 rounded-lg border border-light-border dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Mi Perfil"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
              {user.name.charAt(0)}
            </div>
            <span className="text-xs font-semibold text-light-text dark:text-dark-text max-w-[70px] truncate hidden md:inline">
              {user.name.split(' ')[0]}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
