import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Sparkles, Send, BookOpen, Cpu, ShieldAlert, History, ArrowRight } from 'lucide-react';

export default function ZoneCopilot({
  onSelectCitation,
  onQueryCopilot,
  copilotHistory,
  usageStats,
  isQuerying,
}) {
  const { t } = useLanguage();
  const [queryInput, setQueryInput] = useState('');

  // Quick suggestion prompts for instant demo
  const suggestions = [
    "¿Qué se acordó en la reunión de despliegue?",
    "¿Cuál es la política de borrado de mensajes?",
    "¿Cuáles son los temas de la reunión de liderazgo?",
  ];

  // Handle form submit
  const handleQuery = (e) => {
    e.preventDefault();
    const q = queryInput.trim();
    if (!q || isQuerying) return;

    onQueryCopilot(q);
    setQueryInput('');
  };

  const handleSuggestionClick = (promptText) => {
    setQueryInput(promptText);
  };

  return (
    <div className="flex flex-col h-full bg-light-card dark:bg-dark-card border-l border-light-border dark:border-dark-border select-none">
      {/* Copilot Header */}
      <div className="p-3 border-b border-light-border dark:border-dark-border space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent">
              <Sparkles size={16} />
            </div>
            <h2 className="text-sm font-bold text-light-text dark:text-dark-text tracking-wide uppercase">
              {t.copilotTitle}
            </h2>
          </div>

          {/* Token Usage Badge */}
          {usageStats && (
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-light-muted dark:text-dark-muted border border-light-border dark:border-dark-border">
              <Cpu size={11} className="text-light-accent dark:text-dark-accent" />
              <span>{usageStats.total_tokens || 0} tokens</span>
            </div>
          )}
        </div>
        <p className="text-[11px] text-light-muted dark:text-dark-muted">
          {t.copilotSubtitle}
        </p>
      </div>

      {/* Query Suggestions */}
      <div className="p-3 bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-light-border/60 dark:border-dark-border/60 space-y-1.5">
        <div className="text-[10px] font-bold text-light-muted dark:text-dark-muted uppercase tracking-wider">
          Sugerencias RAG:
        </div>
        <div className="flex flex-col space-y-1">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSuggestionClick(s)}
              className="text-left text-[11px] px-2 py-1 rounded bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text hover:border-light-accent dark:hover:border-dark-accent hover:text-light-accent dark:hover:text-dark-accent transition-colors truncate"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Answers / Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {copilotHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-light-muted dark:text-dark-muted space-y-2">
            <Sparkles size={28} className="text-light-accent dark:text-dark-accent opacity-60" />
            <p>{t.copilotEmptyHistory}</p>
          </div>
        ) : (
          copilotHistory.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg space-y-2 text-xs shadow-sm"
            >
              {/* User Prompt */}
              <div className="font-semibold text-light-accent dark:text-dark-accent flex items-start space-x-1.5">
                <ArrowRight size={14} className="mt-0.5 shrink-0" />
                <span>{item.query}</span>
              </div>

              {/* Copilot Answer */}
              <div className="text-light-text dark:text-dark-text leading-relaxed bg-light-card dark:bg-dark-card p-2.5 rounded-lg border border-light-border/60 dark:border-dark-border/60">
                {item.answer}
              </div>

              {/* Citations section */}
              {item.citations && item.citations.length > 0 && (
                <div className="pt-1 space-y-1">
                  <div className="text-[10px] font-bold text-light-muted dark:text-dark-muted flex items-center space-x-1">
                    <BookOpen size={11} />
                    <span>{t.copilotCitations}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.citations.map((c, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => onSelectCitation(c.message_id)}
                        className="px-2 py-1 text-[11px] rounded bg-light-card dark:bg-dark-card border border-light-accent/40 dark:border-dark-accent/40 text-light-text dark:text-dark-text hover:bg-light-accent hover:text-white dark:hover:bg-dark-accent dark:hover:text-black transition-colors text-left"
                        title={c.snippet}
                      >
                        <span className="font-bold mr-1">[{cIdx + 1}]</span>
                        <span className="truncate max-w-[180px] inline-block align-bottom">{c.snippet}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Query Meta Details */}
              <div className="flex items-center justify-between text-[10px] text-light-muted dark:text-dark-muted pt-1 border-t border-light-border/40 dark:border-dark-border/40">
                <span>{t.copilotTokensUsed} {item.tokens_used || 0}</span>
                {item.system_prompt_version && (
                  <span>{t.copilotSystemVersion} v{item.system_prompt_version}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Copilot Query Input Bar */}
      <form
        onSubmit={handleQuery}
        className="p-3 bg-light-card dark:bg-dark-card border-t border-light-border dark:border-dark-border"
      >
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder={t.copilotQueryPlaceholder}
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent transition-colors"
          />
          <button
            type="submit"
            disabled={!queryInput.trim() || isQuerying}
            className="px-3 py-2 rounded-lg bg-light-accent dark:bg-dark-accent text-white dark:text-black font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center space-x-1 shadow-sm"
          >
            {isQuerying ? (
              <span>{t.copilotAskingBtn}</span>
            ) : (
              <>
                <Sparkles size={14} />
                <span className="hidden sm:inline">{t.copilotAskBtn}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
