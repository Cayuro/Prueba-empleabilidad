import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Hash, Lock, Users, MessageSquare } from 'lucide-react';

export default function ZoneConversations({
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  isLoading,
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter channels based on search input
  const filteredChannels = channels.filter((c) =>
    c.rw_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle new channel submission
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateChannel({
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        is_private: isPrivate,
      });
      setNewChannelName('');
      setIsPrivate(false);
      setShowCreateModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border select-none">
      {/* Header & Search Area */}
      <div className="p-3 border-b border-light-border dark:border-dark-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare size={18} className="text-light-accent dark:text-dark-accent" />
            <h2 className="text-sm font-bold text-light-text dark:text-dark-text tracking-wide uppercase">
              {t.channelsTitle}
            </h2>
          </div>
          {/* New Channel Button */}
          <button
            onClick={() => setShowCreateModal(!showCreateModal)}
            className="p-1 rounded-md bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent hover:bg-light-accent hover:text-white dark:hover:bg-dark-accent dark:hover:text-black transition-colors"
            title={t.newChannel}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-light-muted dark:text-dark-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchChannelsPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent transition-colors"
          />
        </div>
      </div>

      {/* New Channel Inline Modal */}
      {showCreateModal && (
        <form onSubmit={handleCreateSubmit} className="p-3 bg-neutral-100/60 dark:bg-neutral-900/60 border-b border-light-border dark:border-dark-border space-y-2">
          <div className="text-xs font-semibold text-light-text dark:text-dark-text">
            {t.createChannelTitle}
          </div>
          <input
            type="text"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder={t.channelNamePlaceholder}
            autoFocus
            className="w-full px-2.5 py-1 text-xs rounded border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent"
          />
          <label className="flex items-center space-x-2 text-xs text-light-muted dark:text-dark-muted cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded accent-light-accent dark:accent-dark-accent"
            />
            <span>{t.isPrivateLabel}</span>
          </label>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-2 py-1 text-xs rounded text-light-muted dark:text-dark-muted hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newChannelName.trim()}
              className="px-2.5 py-1 text-xs font-bold rounded bg-light-accent dark:bg-dark-accent text-white dark:text-black hover:opacity-90 disabled:opacity-50"
            >
              {t.createChannelBtn}
            </button>
          </div>
        </form>
      )}

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto divide-y divide-light-border/40 dark:divide-dark-border/40">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-light-muted dark:text-dark-muted">
            {t.loadingChannels}
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="p-4 text-center text-xs text-light-muted dark:text-dark-muted">
            {t.noChannelsFound}
          </div>
        ) : (
          filteredChannels.map((channel) => {
            const isActive = channel.rw_id === activeChannelId;
            return (
              <button
                key={channel.rw_id}
                onClick={() => onSelectChannel(channel)}
                className={`w-full text-left p-3 flex items-start space-x-3 transition-colors ${
                  isActive
                    ? 'bg-light-accent/15 dark:bg-dark-accent/15 border-l-4 border-light-accent dark:border-dark-accent'
                    : 'hover:bg-neutral-100/70 dark:hover:bg-neutral-900/70'
                }`}
              >
                {/* Channel Privacy Icon */}
                <div className={`mt-0.5 p-1 rounded ${isActive ? 'text-light-accent dark:text-dark-accent' : 'text-light-muted dark:text-dark-muted'}`}>
                  {channel.rw_is_private ? <Lock size={15} /> : <Hash size={15} />}
                </div>

                {/* Channel Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold truncate ${isActive ? 'text-light-accent dark:text-dark-accent' : 'text-light-text dark:text-dark-text'}`}>
                      {channel.rw_name}
                    </span>
                    {channel.unread_count > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-light-accent dark:bg-dark-accent text-white dark:text-black">
                        {channel.unread_count}
                      </span>
                    )}
                  </div>
                  {channel.last_message && (
                    <p className="text-[11px] text-light-muted dark:text-dark-muted truncate mt-0.5">
                      {channel.last_message}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
