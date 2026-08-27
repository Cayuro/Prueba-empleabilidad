import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Sparkles, Send, BookOpen, Cpu, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function ZoneCopilot({
  onSelectCitation,
  onQueryCopilot,
  copilotHistory,
  usageStats,
  isQuerying,
}) {
  const { t } = useLanguage();
  const [queryInput, setQueryInput] = useState('');
  const historyEndRef = useRef(null);

  // Auto-scroll to bottom of Copilot conversation stream when a new answer arrives
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotHistory, isQuerying]);

  // Quick suggestion prompts for instant demo
  const suggestions = [
    "¿Qué se acordó en la reunión de despliegue?",
    "¿Cuáles fueron los temas de la reunión de liderazgo?",
    "¿Qué se habló sobre el diseño de frontend?",
    "¿Cuánto es 5 + 5?",
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
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/20">
              <Sparkles size={16} className="text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-light-text dark:text-dark-text tracking-wide">
                {t.copilotTitle}
              </h2>
              <p className="text-[10px] text-light-muted dark:text-dark-muted">
                {t.copilotSubtitle}
              </p>
            </div>
          </div>

          {/* Token Usage Badge */}
          {usageStats && (
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-light-muted dark:text-dark-muted border border-light-border dark:border-dark-border">
              <Cpu size={11} className="text-purple-500" />
              <span>{usageStats.total_tokens || 0} tokens</span>
            </div>
          )}
        </div>
      </div>

      {/* Query Suggestions */}
      <div className="p-2.5 bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-light-border/60 dark:border-dark-border/60 space-y-1">
        <div className="text-[10px] font-bold text-light-muted dark:text-dark-muted uppercase tracking-wider">
          Sugerencias RAG:
        </div>
        <div className="flex flex-col space-y-1">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSuggestionClick(s)}
              className="text-left text-[11px] px-2 py-1 rounded bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text hover:border-purple-500 dark:hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors truncate"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Answers / Conversation Stream (Chronological order: top to bottom) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {copilotHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-light-muted dark:text-dark-muted space-y-2">
            <Sparkles size={28} className="text-purple-500 opacity-60" />
            <p>{t.copilotEmptyHistory}</p>
          </div>
        ) : (
          copilotHistory.map((item, idx) => {
            const isNotFound = item.answer_found === false || item.answer?.includes('⚠️ No encontré esa información') || item.answer?.includes('Contexto autorizado insuficiente');

            return (
              <div
                key={idx}
                className="p-3 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg space-y-2 text-xs shadow-sm"
              >
                {/* User Prompt */}
                <div className="font-semibold text-purple-600 dark:text-purple-400 flex items-start space-x-1.5">
                  <ArrowRight size={14} className="mt-0.5 shrink-0" />
                  <span>{item.query}</span>
                </div>

                {/* Copilot Answer / Warning box */}
                {isNotFound ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start space-x-2">
                    <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span className="font-semibold">{item.answer}</span>
                  </div>
                ) : (
                  <div className="text-light-text dark:text-dark-text leading-relaxed bg-light-card dark:bg-dark-card p-2.5 rounded-lg border border-light-border/60 dark:border-dark-border/60 whitespace-pre-line">
                    {item.answer}
                  </div>
                )}

                {/* Citations section (STRICTLY MAXIMUM 2 CITATIONS) */}
                {!isNotFound && item.citations && item.citations.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <div className="text-[10px] font-bold text-light-muted dark:text-dark-muted flex items-center space-x-1">
                      <BookOpen size={11} className="text-purple-500" />
                      <span>Citas autorizadas ({Math.min(2, item.citations.length)} máx):</span>
                    </div>
                    <div className="flex flex-col space-y-1">
                      {item.citations.slice(0, 2).map((c, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={() => onSelectCitation(c.message_id)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-light-card dark:bg-dark-card border border-purple-500/30 dark:border-purple-500/30 text-light-text dark:text-dark-text hover:bg-purple-600 hover:text-white dark:hover:bg-purple-500 dark:hover:text-black transition-colors text-left truncate flex items-center space-x-1.5"
                          title={c.snippet}
                        >
                          <span className="font-bold text-purple-600 dark:text-purple-400">[{cIdx + 1}]</span>
                          <span className="truncate">{c.snippet}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Query Meta Details */}
                <div className="flex items-center justify-between text-[10px] text-light-muted dark:text-dark-muted pt-1 border-t border-light-border/40 dark:border-dark-border/40">
                  <span>{t.copilotTokensUsed} {item.tokens_used || 0}</span>
                  {item.system_prompt_version && (
                    <span>v{item.system_prompt_version}</span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isQuerying && (
          <div className="p-3 rounded-xl border border-purple-500/30 bg-purple-500/5 dark:bg-purple-500/10 text-xs flex items-center space-x-2 text-purple-600 dark:text-purple-400 animate-pulse">
            <Sparkles size={16} />
            <span className="font-semibold">Consultando contexto autorizado...</span>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={historyEndRef} />
      </div>

      {/* Copilot Query Input Bar */}
      <form
        onSubmit={handleQuery}
        className="p-2.5 bg-light-card dark:bg-dark-card border-t border-light-border dark:border-dark-border"
      >
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder={t.copilotQueryPlaceholder}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-colors"
          />
          <button
            type="submit"
            disabled={!queryInput.trim() || isQuerying}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center space-x-1 shadow-sm cursor-pointer"
          >
            {isQuerying ? (
              <span>...</span>
            ) : (
              <>
                <Send size={13} />
                <span className="hidden sm:inline">Consultar</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
