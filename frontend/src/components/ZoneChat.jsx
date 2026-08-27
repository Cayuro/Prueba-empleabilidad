import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Send, CheckCheck, Clock, AlertCircle, Hash, Lock, Trash2, UserPlus, Users, X, Check } from 'lucide-react';

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
  const { user, token } = useAuth();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const composerInputRef = useRef(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [channelMembers, setChannelMembers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');

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

  // Load users and existing members when opening invite modal
  const handleOpenInvite = async () => {
    if (!activeChannel) return;
    const channelId = activeChannel.rw_channel_id || activeChannel.rw_id;
    setShowInviteModal(true);
    setIsLoadingUsers(true);
    setInviteSuccessMsg('');
    try {
      const [usersList, membersList] = await Promise.all([
        api.getUsers('', token),
        api.getChannelMembers(channelId, token),
      ]);
      setAvailableUsers(usersList || []);
      setChannelMembers(membersList || []);
    } catch (e) {
      console.error('Error loading users for invitation:', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Invite a specific user to this channel
  const handleInviteUser = async (targetUser) => {
    if (!activeChannel || !targetUser) return;
    const channelId = activeChannel.rw_channel_id || activeChannel.rw_id;
    try {
      await api.addChannelMember(channelId, targetUser.rw_id, 'member', token);
      setChannelMembers((prev) => [...prev, { rw_user_id: targetUser.rw_id }]);
      setInviteSuccessMsg(`¡${targetUser.rw_name} fue añadido al grupo!`);
      setTimeout(() => setInviteSuccessMsg(''), 3000);
    } catch (e) {
      console.error('Error inviting user:', e);
    }
  };

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

  // Author color hash generator for WhatsApp group chats
  const getAuthorColor = (name) => {
    const colors = [
      'text-emerald-600 dark:text-emerald-400',
      'text-teal-600 dark:text-teal-400',
      'text-indigo-600 dark:text-indigo-400',
      'text-amber-600 dark:text-amber-400',
      'text-rose-600 dark:text-rose-400',
      'text-cyan-600 dark:text-cyan-400',
      'text-orange-600 dark:text-orange-400',
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (!activeChannel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#efeae2] dark:bg-[#0b141a]">
        <div className="w-16 h-16 rounded-full bg-neutral-300/60 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400 mb-3 shadow-inner">
          <Hash size={32} />
        </div>
        <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
          {t.selectChannelPrompt}
        </p>
      </div>
    );
  }

  const isPrivate = activeChannel.rw_channel_is_private !== undefined ? activeChannel.rw_channel_is_private : activeChannel.rw_is_private;
  const channelDisplayName = activeChannel.rw_name || activeChannel.rw_channel_name;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] relative select-none">
      {/* Active Channel Top Bar */}
      <div className="px-4 py-2.5 border-b border-neutral-300 dark:border-neutral-800 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow">
            {isPrivate ? <Lock size={16} /> : <Users size={16} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111b21] dark:text-[#e9edef] flex items-center space-x-1.5">
              <span>{channelDisplayName}</span>
              {isPrivate && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  Privado
                </span>
              )}
            </h3>
            <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">
              {isPrivate ? 'Grupo Privado • Solo miembros invitados' : 'Canal Público • Acceso abierto'}
            </span>
          </div>
        </div>

        {/* Channel Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenInvite}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400 transition-colors shadow-sm"
            title="Invitar personas a este grupo"
          >
            <UserPlus size={14} />
            <span className="hidden sm:inline">Invitar miembros</span>
          </button>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="absolute top-14 right-4 z-30 w-80 max-h-96 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#202c33] shadow-2xl flex flex-col p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2">
            <div className="flex items-center space-x-2 font-bold text-xs text-[#111b21] dark:text-[#e9edef]">
              <Users size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>Invitar usuarios a #{channelDisplayName}</span>
            </div>
            <button
              onClick={() => setShowInviteModal(false)}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1"
            >
              <X size={16} />
            </button>
          </div>

          {inviteSuccessMsg && (
            <div className="p-2 text-xs rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-center">
              {inviteSuccessMsg}
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 max-h-60">
            {isLoadingUsers ? (
              <div className="text-center py-4 text-xs text-neutral-500">
                Cargando usuarios...
              </div>
            ) : availableUsers.length === 0 ? (
              <div className="text-center py-4 text-xs text-neutral-500">
                No hay otros usuarios registrados
              </div>
            ) : (
              availableUsers.map((u) => {
                const isAlreadyMember = channelMembers.some((m) => m.rw_user_id === u.rw_id);
                const isCurrentSelf = u.rw_id === user?.id;

                return (
                  <div
                    key={u.rw_id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 text-xs"
                  >
                    <div className="truncate mr-2">
                      <div className="font-bold text-[#111b21] dark:text-[#e9edef] truncate">
                        {u.rw_name} {isCurrentSelf && <span className="text-[10px] text-neutral-500">(Tú)</span>}
                      </div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                        {u.rw_email} • <span className="capitalize">{u.rw_role}</span>
                      </div>
                    </div>

                    {isAlreadyMember ? (
                      <span className="flex items-center space-x-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                        <Check size={12} />
                        <span>Miembro</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInviteUser(u)}
                        className="px-3 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black hover:opacity-90 transition-opacity"
                      >
                        Invitar
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Messages Scroll Area styled like WhatsApp Chat */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {/* Keyset Pagination Button */}
        {hasMoreHistory && (
          <div className="flex justify-center mb-2">
            <button
              onClick={onLoadOlderMessages}
              disabled={isLoadingHistory}
              className="px-3.5 py-1 text-[11px] font-semibold rounded-full bg-white/80 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 transition-colors shadow-sm backdrop-blur"
            >
              {isLoadingHistory ? t.loadingHistory : t.loadOlderMessages}
            </button>
          </div>
        )}

        {/* Message Stream */}
        {messages.length === 0 ? (
          <div className="text-center py-16 text-xs text-neutral-500 dark:text-neutral-400">
            {isLoadingHistory ? t.loadingHistory : t.noMessagesInChannel}
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.rw_author_id === user?.id;
            const isHighlighted = msg.rw_id === highlightedMessageId;
            const authorName = isSelf ? 'Tú' : (msg.author_name || 'Miembro');

            return (
              <div
                key={msg.rw_id}
                id={`msg-${msg.rw_id}`}
                className={`flex flex-col group ${isSelf ? 'items-end' : 'items-start'} ${
                  isHighlighted ? 'ring-2 ring-emerald-500 rounded-2xl p-0.5' : ''
                }`}
              >
                {/* WhatsApp Bubble */}
                <div
                  className={`relative max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl shadow-sm transition-all duration-200 ${
                    isSelf
                      ? 'bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef] rounded-tr-none'
                      : 'bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef] rounded-tl-none border border-neutral-200/50 dark:border-neutral-800/50'
                  }`}
                >
                  {/* Author Name in Group Chats */}
                  {!isSelf && (
                    <div className={`text-[11px] font-bold mb-0.5 ${getAuthorColor(authorName)}`}>
                      {authorName}
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="text-xs leading-relaxed break-words whitespace-pre-wrap select-text">
                    {msg.rw_content}
                  </div>

                  {/* Bottom Meta: Timestamp & Read Status */}
                  <div className="flex items-center justify-end space-x-1 mt-1 -mb-0.5 pl-4 text-[10px] text-[#667781] dark:text-[#8696a0] select-none">
                    <span>
                      {msg.rw_created_at
                        ? new Date(msg.rw_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>

                    {/* Self Status Indicator */}
                    {isSelf && (
                      <span className="ml-1">
                        {msg.status === 'pending' && (
                          <Clock size={11} className="text-amber-500 animate-spin" title={t.messageStatusPending} />
                        )}
                        {msg.status === 'sent' && (
                          <CheckCheck size={13} className="text-sky-500 dark:text-sky-400" title={t.messageStatusSent} />
                        )}
                        {msg.status === 'failed' && (
                          <button
                            onClick={() => onRetryMessage(msg)}
                            className="text-rose-500 hover:opacity-80"
                            title={t.retry}
                          >
                            <AlertCircle size={13} />
                          </button>
                        )}
                      </span>
                    )}

                    {/* Delete Message Action */}
                    {isSelf && (
                      <button
                        onClick={() => onDeleteMessage(msg.rw_id)}
                        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-500 transition-opacity ml-1.5"
                        title={t.deleteMessage}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer Area styled like WhatsApp */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-neutral-300 dark:border-neutral-800 flex items-center space-x-2"
      >
        <input
          ref={composerInputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.typeMessagePlaceholder}
          className="flex-1 px-4 py-2 text-xs rounded-full bg-white dark:bg-[#2a3942] border-0 text-[#111b21] dark:text-[#e9edef] placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="w-9 h-9 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white dark:text-black font-bold flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity shadow-md shrink-0"
          title={t.sendMessageBtn}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
