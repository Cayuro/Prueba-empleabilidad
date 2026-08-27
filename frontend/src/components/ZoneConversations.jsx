import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Hash, Lock, Users, MessageSquare, Check, Shield } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'public', 'private'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter channels based on search input and active tab (all, public, private)
  const filteredChannels = channels.filter((c) => {
    const channelName = c.rw_channel_name || c.rw_name || '';
    const matchesSearch = channelName.toLowerCase().includes(searchTerm.toLowerCase());
    const isPrivateChan = c.rw_channel_is_private !== undefined ? c.rw_channel_is_private : c.rw_is_private;

    if (!matchesSearch) return false;
    if (activeTab === 'public') return !isPrivateChan;
    if (activeTab === 'private') return isPrivateChan;
    return true;
  });

  const publicCount = channels.filter((c) => !(c.rw_channel_is_private !== undefined ? c.rw_channel_is_private : c.rw_is_private)).length;
  const privateCount = channels.filter((c) => (c.rw_channel_is_private !== undefined ? c.rw_channel_is_private : c.rw_is_private)).length;

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

  // Helper avatar colors for WhatsApp look
  const getAvatarColor = (name) => {
    const colors = [
      'bg-emerald-600 text-white',
      'bg-teal-600 text-white',
      'bg-indigo-600 text-white',
      'bg-amber-600 text-white',
      'bg-rose-600 text-white',
      'bg-cyan-600 text-white',
      'bg-orange-600 text-white',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="flex flex-col h-full bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border select-none">
      {/* Header & New Chat Action */}
      <div className="p-3 border-b border-light-border dark:border-dark-border space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
              <MessageSquare size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-light-text dark:text-dark-text tracking-wide">
                Chats
              </h2>
              <p className="text-[10px] text-light-muted dark:text-dark-muted">
                {user?.name} {user?.role === 'admin' && <span className="font-semibold text-amber-500">(Admin)</span>}
              </p>
            </div>
          </div>
          {/* New Channel Button */}
          <button
            onClick={() => setShowCreateModal(!showCreateModal)}
            className="p-1.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-black transition-colors"
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
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
          />
        </div>

        {/* WhatsApp-Style Filter Pills (Todos, Públicos, Privados) */}
        <div className="flex space-x-1.5 pt-0.5">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors flex items-center space-x-1 ${
              activeTab === 'all'
                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black'
                : 'bg-neutral-100 dark:bg-neutral-800 text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            <span>Todos</span>
            <span className="text-[10px] opacity-80">({channels.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('public')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors flex items-center space-x-1 ${
              activeTab === 'public'
                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black'
                : 'bg-neutral-100 dark:bg-neutral-800 text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            <span>Públicos</span>
            <span className="text-[10px] opacity-80">({publicCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('private')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors flex items-center space-x-1 ${
              activeTab === 'private'
                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black'
                : 'bg-neutral-100 dark:bg-neutral-800 text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            <Lock size={10} />
            <span>Privados</span>
            <span className="text-[10px] opacity-80">({privateCount})</span>
          </button>
        </div>
      </div>

      {/* New Channel Inline Modal */}
      {showCreateModal && (
        <form onSubmit={handleCreateSubmit} className="p-3 bg-neutral-100/80 dark:bg-neutral-900/80 border-b border-light-border dark:border-dark-border space-y-2">
          <div className="text-xs font-bold text-light-text dark:text-dark-text">
            {t.createChannelTitle}
          </div>
          <input
            type="text"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder={t.channelNamePlaceholder}
            autoFocus
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
          />
          <label className="flex items-center space-x-2 text-xs text-light-muted dark:text-dark-muted cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded accent-emerald-600 dark:accent-emerald-500"
            />
            <span className="font-semibold">{t.isPrivateLabel}</span>
          </label>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-2.5 py-1 text-xs rounded text-light-muted dark:text-dark-muted hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newChannelName.trim()}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black hover:opacity-90 disabled:opacity-50"
            >
              {t.createChannelBtn}
            </button>
          </div>
        </form>
      )}

      {/* Channels List Styled as WhatsApp Chats */}
      <div className="flex-1 overflow-y-auto divide-y divide-light-border/30 dark:divide-dark-border/30">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-light-muted dark:text-dark-muted">
            {t.loadingChannels}
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="p-6 text-center text-xs text-light-muted dark:text-dark-muted">
            {t.noChannelsFound}
          </div>
        ) : (
          filteredChannels.map((channel) => {
            const channelId = channel.rw_channel_id || channel.rw_id;
            const channelName = channel.rw_channel_name || channel.rw_name;
            const isPrivateChan = channel.rw_channel_is_private !== undefined ? channel.rw_channel_is_private : channel.rw_is_private;
            const unreadCount = channel.rw_unread_count !== undefined ? channel.rw_unread_count : (channel.unread_count || 0);
            const lastMsg = channel.rw_last_message_content || channel.last_message || '';
            const lastAuthor = channel.rw_last_message_author_name || '';
            const isActive = channelId === activeChannelId;

            return (
              <button
                key={channelId}
                onClick={() => onSelectChannel({ ...channel, rw_id: channelId, rw_name: channelName, rw_is_private: isPrivateChan })}
                className={`w-full text-left px-3 py-2.5 flex items-center space-x-3 transition-colors ${
                  isActive
                    ? 'bg-emerald-500/15 dark:bg-emerald-500/20 border-l-4 border-emerald-600 dark:border-emerald-400'
                    : 'hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80'
                }`}
              >
                {/* WhatsApp Group Avatar Circle */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${getAvatarColor(channelName)}`}>
                  {isPrivateChan ? <Lock size={16} /> : <Users size={16} />}
                </div>

                {/* Channel Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className={`text-xs font-bold truncate ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-light-text dark:text-dark-text'}`}>
                        {channelName}
                      </span>
                      {isPrivateChan && (
                        <span className="px-1 py-0.2 text-[9px] font-bold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          Privado
                        </span>
                      )}
                    </div>

                    {unreadCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black shrink-0">
                        {unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Last Message Preview */}
                  <div className="flex items-center space-x-1 text-[11px] text-light-muted dark:text-dark-muted truncate mt-0.5">
                    {lastAuthor && <span className="font-semibold text-neutral-500 dark:text-neutral-400">{lastAuthor}:</span>}
                    <span className="truncate">{lastMsg || 'Sin mensajes aún'}</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
