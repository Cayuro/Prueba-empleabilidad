import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Send, Check, CheckCheck, Clock, AlertCircle, RefreshCw, Hash, Lock, Trash2 } from 'lucide-react';

export default function ZoneChat({
  activeChannel,
  messages,
  isLoadingHistory,
  onSendMessage,
  onRetryMessage,
  onDeleteMessage,
  onLoadOlderMessages,
  hasMoreHistory,
  highlightedMessageId,
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const composerInputRef = useRef(null);

  // Auto-scroll to bottom on new message or channel change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel]);

  // Scroll to highlighted citation message if selected from Copilot
  useEffect(() => {
    if (highlightedMessageId) {
      const el = document.getElementById(`msg-${highlightedMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedMessageId]);

  // Handle form send
  const handleSubmit = (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !activeChannel) return;

    onSendMessage(text);
    setInputText('');
  };

  // Keyboard shortcut: Enter sends message, Shift+Enter new line
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!activeChannel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-light-bg dark:bg-dark-bg">
        <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-light-muted dark:text-dark-muted mb-3">
          <Hash size={32} />
        </div>
        <p className="text-sm font-semibold text-light-muted dark:text-dark-muted">
          {t.selectChannelPrompt}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-light-bg dark:bg-dark-bg">
      {/* Active Channel Top Bar */}
      <div className="px-4 py-3 border-b border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="p-1 rounded bg-neutral-100 dark:bg-neutral-800 text-light-accent dark:text-dark-accent">
            {activeChannel.rw_is_private ? <Lock size={16} /> : <Hash size={16} />}
          </span>
          <div>
            <h3 className="text-sm font-bold text-light-text dark:text-dark-text">
              {activeChannel.rw_name}
            </h3>
            <span className="text-[11px] text-light-muted dark:text-dark-muted">
              {activeChannel.rw_is_private ? t.privateBadge : t.publicBadge}
            </span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Keyset Pagination Button */}
        {hasMoreHistory && (
          <div className="flex justify-center">
            <button
              onClick={onLoadOlderMessages}
              disabled={isLoadingHistory}
              className="px-3 py-1 text-xs font-semibold rounded-full bg-neutral-200 dark:bg-neutral-800 text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text transition-colors"
            >
              {isLoadingHistory ? t.loadingHistory : t.loadOlderMessages}
            </button>
          </div>
        )}

        {/* Message stream */}
        {messages.length === 0 ? (
          <div className="text-center py-12 text-xs text-light-muted dark:text-dark-muted">
            {t.noMessagesInChannel}
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.rw_author_id === user?.id;
            const isHighlighted = msg.rw_id === highlightedMessageId;

            return (
              <div
                key={msg.rw_id}
                id={`msg-${msg.rw_id}`}
                className={`flex flex-col group transition-all duration-300 ${
                  isSelf ? 'items-end' : 'items-start'
                } ${isHighlighted ? 'ring-2 ring-light-accent dark:ring-dark-accent rounded-lg p-1 bg-light-accent/10 dark:bg-dark-accent/10' : ''}`}
              >
                {/* Author Name and Timestamp */}
                <div className="flex items-center space-x-2 text-[11px] text-light-muted dark:text-dark-muted mb-1 px-1">
                  <span className="font-semibold text-light-text dark:text-dark-text">
                    {isSelf ? 'You' : msg.author_name || 'Member'}
                  </span>
                  <span>
                    {msg.rw_created_at
                      ? new Date(msg.rw_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                </div>

                {/* Bubble Container */}
                <div className="relative max-w-[80%] flex items-end space-x-1.5">
                  <div
                    className={`px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                      isSelf
                        ? 'bg-light-accent dark:bg-dark-accent text-white dark:text-black rounded-br-none font-medium'
                        : 'bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border text-light-text dark:text-dark-text rounded-bl-none'
                    }`}
                  >
                    {msg.rw_content}
                  </div>

                  {/* Self Message Actions & Status Indicator */}
                  {isSelf && (
                    <div className="flex items-center space-x-1 pb-1">
                      {/* Status: pending / sent / failed */}
                      {msg.status === 'pending' && (
                        <Clock size={12} className="text-amber-500 animate-spin" title={t.messageStatusPending} />
                      )}
                      {msg.status === 'sent' && (
                        <CheckCheck size={14} className="text-light-accent dark:text-dark-accent" title={t.messageStatusSent} />
                      )}
                      {msg.status === 'failed' && (
                        <button
                          onClick={() => onRetryMessage(msg)}
                          className="text-red-500 hover:opacity-80"
                          title={t.retry}
                        >
                          <AlertCircle size={14} />
                        </button>
                      )}

                      {/* Delete button */}
                      <button
                        onClick={() => onDeleteMessage(msg.rw_id)}
                        className="opacity-0 group-hover:opacity-100 text-light-muted dark:text-dark-muted hover:text-red-500 transition-opacity p-0.5"
                        title={t.deleteMessage}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer Area */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-light-card dark:bg-dark-card border-t border-light-border dark:border-dark-border"
      >
        <div className="flex items-center space-x-2">
          <input
            ref={composerInputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.typeMessagePlaceholder}
            className="flex-1 px-3.5 py-2 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-lg bg-light-accent dark:bg-dark-accent text-white dark:text-black font-bold hover:opacity-90 disabled:opacity-40 transition-opacity shadow-sm"
            title={t.sendMessageBtn}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
