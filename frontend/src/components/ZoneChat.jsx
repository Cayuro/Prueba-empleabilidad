import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Send,
  Trash2,
  AlertCircle,
  Clock,
  Check,
  CheckCheck,
  Hash,
  Lock,
  Users,
  ChevronUp,
  UserPlus,
  X,
  Pencil,
} from 'lucide-react';

export default function ZoneChat({
  activeChannel,
  messages,
  isLoadingHistory,
  onSendMessage,
  onRetryMessage,
  onDeleteMessage,
  onEditMessage,
  onLoadOlderMessages,
  hasMoreHistory,
  highlightedMessageId,
}) {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const [inputText, setInputText] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');

  // Inline message editing state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const composerInputRef = useRef(null);

  // Auto-scroll to bottom only on initial load or when a new message is sent/received at the bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeChannel?.rw_id]);

  // Focus message composer on channel switch
  useEffect(() => {
    composerInputRef.current?.focus();
    setEditingMessageId(null);
  }, [activeChannel?.rw_id]);

  // Fetch registered users when opening invitation modal
  const handleOpenInvite = async () => {
    setShowInviteModal(true);
    setIsLoadingUsers(true);
    setInviteSuccessMsg('');
    try {
      const allUsers = await api.getUsers('', token);
      const channelId = activeChannel.rw_channel_id || activeChannel.rw_id;
      const currentMembers = await api.getChannelMembers(channelId, token);
      const memberIds = new Set(currentMembers.map((m) => m.rw_user_id || m.id));
      // Filter out users already in this channel
      const uninvited = allUsers.filter((u) => !memberIds.has(u.id || u.rw_id));
      setAvailableUsers(uninvited);
    } catch (e) {
      console.error('Error fetching users for invitation:', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Submit invitation
  const handleInviteUser = async (targetUserId, targetUserName) => {
    const channelId = activeChannel.rw_channel_id || activeChannel.rw_id;
    try {
      await api.addChannelMember(channelId, targetUserId, 'member', token);
      setInviteSuccessMsg(`¡${targetUserName} fue invitado exitosamente!`);
      setAvailableUsers((prev) => prev.filter((u) => (u.id || u.rw_id) !== targetUserId));
      setTimeout(() => setInviteSuccessMsg(''), 3000);
    } catch (e) {
      console.error('Error inviting user:', e);
    }
  };

  // Start editing a message
  const handleStartEdit = (msg) => {
    setEditingMessageId(msg.rw_id);
    setEditingText(msg.rw_content);
    setEditError('');
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
    setEditError('');
  };

  // Submit edited message
  const handleSaveEdit = async (messageId) => {
    if (!editingText.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    setEditError('');
    try {
      const res = await onEditMessage(messageId, editingText.trim());
      if (res && res.success === false) {
        setEditError(res.error || 'Error al editar');
      } else {
        setEditingMessageId(null);
        setEditingText('');
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle message sending form
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(inputText.trim());
    setInputText('');
  };

  // Handle Enter key for sending
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Helper avatar colors for group message authors
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
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400 transition-colors shadow-sm cursor-pointer"
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
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 cursor-pointer"
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
                No hay otros usuarios registrados para invitar
              </div>
            ) : (
              availableUsers.map((u) => (
                <div
                  key={u.id || u.rw_id}
                  className="flex items-center justify-between p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs text-[#111b21] dark:text-[#e9edef] truncate">
                      {u.name || u.rw_name}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate">
                      {u.email || u.rw_email} ({u.role || u.rw_role})
                    </div>
                  </div>
                  <button
                    onClick={() => handleInviteUser(u.id || u.rw_id, u.name || u.rw_name)}
                    className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-black shrink-0 transition-colors cursor-pointer"
                  >
                    Agregar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages Stream Container (WhatsApp Background) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2.5"
      >
        {/* Load Earlier Messages Keyset Trigger Button */}
        {hasMoreHistory && (
          <div className="flex justify-center my-1">
            <button
              onClick={onLoadOlderMessages}
              disabled={isLoadingHistory}
              className="flex items-center space-x-1.5 px-3 py-1 text-xs rounded-full bg-white/80 dark:bg-[#202c33]/80 border border-neutral-300 dark:border-neutral-700 text-[#54656f] dark:text-[#aebac1] hover:bg-white dark:hover:bg-[#202c33] transition-colors shadow-xs cursor-pointer"
            >
              <ChevronUp size={14} />
              <span>{isLoadingHistory ? t.loadingHistory : t.loadOlderMessages}</span>
            </button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-xs text-neutral-500 dark:text-neutral-400 space-y-2">
            <Users size={32} className="opacity-40 text-emerald-500" />
            <p>{t.noMessagesInChannel}</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const authorId = msg.rw_author_id || msg.author_id;
            const authorName = msg.rw_author_name || msg.author_name || 'Miembro';
            const isSelf = authorId === user?.id;
            const isHighlighted = highlightedMessageId === msg.rw_id;
            const isEditingThis = editingMessageId === msg.rw_id;

            return (
              <div
                key={msg.rw_id || `temp-${index}`}
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

                  {/* Inline Message Edit Mode */}
                  {isEditingThis ? (
                    <div className="space-y-1.5 min-w-[200px]">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        autoFocus
                        className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-[#111b21] border border-emerald-500 text-[#111b21] dark:text-[#e9edef] focus:outline-none"
                      />
                      {editError && (
                        <div className="text-[10px] text-red-500 font-bold">{editError}</div>
                      )}
                      <div className="flex justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-2 py-0.5 text-[10px] rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isSavingEdit || !editingText.trim()}
                          onClick={() => handleSaveEdit(msg.rw_id)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Message Content */
                    <div className="text-xs leading-relaxed break-words whitespace-pre-wrap select-text">
                      {msg.rw_content}
                      {msg.rw_updated_at && msg.rw_updated_at !== msg.rw_created_at && (
                        <span className="text-[9px] text-[#667781] dark:text-[#8696a0] ml-1.5 italic">(editado)</span>
                      )}
                    </div>
                  )}

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
                            className="text-rose-500 hover:opacity-80 cursor-pointer"
                            title={t.retry}
                          >
                            <AlertCircle size={13} />
                          </button>
                        )}
                      </span>
                    )}

                    {/* Edit & Delete Message Actions for author */}
                    {isSelf && !isEditingThis && (
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1.5">
                        <button
                          onClick={() => handleStartEdit(msg)}
                          className="text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Editar mensaje"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => onDeleteMessage(msg.rw_id)}
                          className="text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title={t.deleteMessage}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
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
          className="w-9 h-9 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white dark:text-black font-bold flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity shadow-md shrink-0 cursor-pointer"
          title={t.sendMessageBtn}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
