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
  Search,
  Shield,
  UserCheck,
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
  
  // Member management & invitation state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [currentMembers, setCurrentMembers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');
  const [inviteFilter, setInviteFilter] = useState('');
  const [inviteModalTab, setInviteModalTab] = useState('invite'); // 'invite' | 'members'

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
    setShowInviteModal(false);
  }, [activeChannel?.rw_id]);

  // Fetch registered users and current members when opening modal
  const handleOpenInvite = async () => {
    setShowInviteModal(true);
    setIsLoadingUsers(true);
    setInviteSuccessMsg('');
    setInviteFilter('');
    setInviteModalTab('invite');
    try {
      const channelId = activeChannel.rw_channel_id || activeChannel.rw_id;
      const [allUsers, members] = await Promise.all([
        api.getUsers('', token),
        api.getChannelMembers(channelId, token)
      ]);
      setCurrentMembers(members || []);
      const memberIds = new Set((members || []).map((m) => m.rw_user_id || m.id || m.rw_id));
      const uninvited = (allUsers || []).filter((u) => {
        const uid = u.rw_id || u.id;
        return !memberIds.has(uid) && uid !== user?.id && uid !== user?.rw_id;
      });
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
      setInviteSuccessMsg(`¡${targetUserName} fue agregado al grupo!`);
      const updatedMembers = await api.getChannelMembers(channelId, token);
      setCurrentMembers(updatedMembers || []);
      setAvailableUsers((prev) => prev.filter((u) => (u.rw_id || u.id) !== targetUserId));
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
    if (!editingText.trim()) return;
    setIsSavingEdit(true);
    setEditError('');
    try {
      const res = await onEditMessage(messageId, editingText.trim());
      if (res && res.success) {
        setEditingMessageId(null);
        setEditingText('');
      } else {
        setEditError(res?.error || 'Error al guardar la edición');
      }
    } catch {
      setEditError('Error de red al actualizar');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Submit new message
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
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

  const filteredAvailableUsers = availableUsers.filter((u) => {
    const name = (u.rw_name || u.name || '').toLowerCase();
    const email = (u.rw_email || u.email || '').toLowerCase();
    const q = inviteFilter.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const filteredMembers = currentMembers.filter((m) => {
    const name = (m.rw_name || m.name || '').toLowerCase();
    const email = (m.rw_email || m.email || '').toLowerCase();
    const q = inviteFilter.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] relative select-none">
      {/* Active Channel Top Bar */}
      <div className="px-4 py-2.5 border-b border-neutral-300 dark:border-neutral-800 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between shadow-xs z-10">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
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
              {isPrivate ? 'Grupo Privado • Miembros autorizados' : 'Canal Público • Acceso abierto'}
            </span>
          </div>
        </div>

        {/* Channel Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenInvite}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400 transition-colors shadow-xs cursor-pointer"
            title="Administrar e invitar miembros a este grupo"
          >
            <UserPlus size={14} />
            <span className="hidden sm:inline">Miembros ({currentMembers.length || 1})</span>
          </button>
        </div>
      </div>

      {/* Member Management / Invitation Modal */}
      {showInviteModal && (
        <div className="absolute top-14 right-4 z-30 w-88 max-h-[28rem] rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#202c33] shadow-2xl flex flex-col p-4 space-y-3 animate-in fade-in zoom-in-95 duration-100">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2.5">
            <div className="flex items-center space-x-2 font-bold text-xs text-[#111b21] dark:text-[#e9edef]">
              <Users size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>#{channelDisplayName}</span>
            </div>
            <button
              onClick={() => setShowInviteModal(false)}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Subtabs: Invitar vs Miembros */}
          <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1 text-xs">
            <button
              onClick={() => setInviteModalTab('invite')}
              className={`flex-1 py-1 font-bold rounded-md transition-all cursor-pointer ${
                inviteModalTab === 'invite'
                  ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Invitar ({availableUsers.length})
            </button>
            <button
              onClick={() => setInviteModalTab('members')}
              className={`flex-1 py-1 font-bold rounded-md transition-all cursor-pointer ${
                inviteModalTab === 'members'
                  ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Miembros ({currentMembers.length})
            </button>
          </div>

          {/* Search filter in modal */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2 text-neutral-400" />
            <input
              type="text"
              value={inviteFilter}
              onChange={(e) => setInviteFilter(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="w-full pl-7 pr-3 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {inviteSuccessMsg && (
            <div className="p-2 text-xs rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-center">
              {inviteSuccessMsg}
            </div>
          )}

          {/* List Area */}
          <div className="flex-1 overflow-y-auto space-y-1.5 max-h-56 pr-1">
            {isLoadingUsers ? (
              <div className="text-center py-6 text-xs text-neutral-500">Cargando datos...</div>
            ) : inviteModalTab === 'invite' ? (
              filteredAvailableUsers.length === 0 ? (
                <div className="text-center py-6 text-xs text-neutral-500">
                  {inviteFilter ? 'No hay coincidencias' : 'Todos los usuarios ya son miembros de este chat'}
                </div>
              ) : (
                filteredAvailableUsers.map((u) => {
                  const uid = u.rw_id || u.id;
                  const uname = u.rw_name || u.name;
                  const uemail = u.rw_email || u.email;
                  const urole = u.rw_role || u.role;
                  return (
                    <div
                      key={uid}
                      className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 hover:border-emerald-500/40 transition-all"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-xs text-[#111b21] dark:text-[#e9edef] truncate">{uname}</span>
                          <span className="px-1 py-0.2 text-[9px] rounded font-semibold bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 uppercase">
                            {urole}
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">{uemail}</div>
                      </div>
                      <button
                        onClick={() => handleInviteUser(uid, uname)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-black shrink-0 transition-colors cursor-pointer shadow-xs"
                      >
                        Invitar
                      </button>
                    </div>
                  );
                })
              )
            ) : (
              filteredMembers.length === 0 ? (
                <div className="text-center py-6 text-xs text-neutral-500">No se encontraron miembros</div>
              ) : (
                filteredMembers.map((m) => {
                  const mid = m.rw_user_id || m.id;
                  const mname = m.rw_name || m.name || 'Usuario';
                  const memail = m.rw_email || m.email || '';
                  const mrole = m.rw_role || m.role || 'member';
                  return (
                    <div
                      key={mid}
                      className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-xs text-[#111b21] dark:text-[#e9edef] truncate">{mname}</span>
                          <span className={`px-1.5 py-0.2 text-[9px] rounded font-bold uppercase ${
                            mrole === 'admin'
                              ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                              : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                          }`}>
                            {mrole}
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">{memail}</div>
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                        <UserCheck size={12} />
                        <span>Activo</span>
                      </span>
                    </div>
                  );
                })
              )
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
              className="flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-white/80 dark:bg-[#202c33]/80 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-xs cursor-pointer"
            >
              <ChevronUp size={14} />
              <span>{isLoadingHistory ? t.loadingEarlierMessages : t.loadEarlierMessages}</span>
            </button>
          </div>
        )}

        {messages.length === 0 && !isLoadingHistory && (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center text-neutral-500 dark:text-neutral-400 space-y-2">
            <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
              <Lock size={20} />
            </div>
            <p className="text-xs font-semibold max-w-xs">
              {isPrivate
                ? 'Los mensajes en este grupo privado están protegidos por Row Level Security (RLS).'
                : t.noMessagesYet}
            </p>
          </div>
        )}

        {/* WhatsApp-Style Chat Message Bubbles */}
        {messages.map((msg) => {
          const isMe = (msg.rw_author_id || msg.author_id) === user?.id;
          const isHighlighted = highlightedMessageId === msg.rw_id;
          const isPending = msg.status === 'pending';
          const isFailed = msg.status === 'failed';
          const isEditing = editingMessageId === msg.rw_id;

          const timestamp = msg.rw_created_at
            ? new Date(msg.rw_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
          const authorName = msg.author_name || (isMe ? user?.name : 'Usuario');
          const isEdited = msg.rw_updated_at && msg.rw_updated_at !== msg.rw_created_at;

          return (
            <div
              key={msg.rw_id || msg.temp_id || Math.random()}
              id={`msg-${msg.rw_id}`}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} transition-colors duration-300`}
            >
              <div
                className={`relative group max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 shadow-xs transition-all ${
                  isHighlighted
                    ? 'ring-2 ring-emerald-500 scale-[1.01]'
                    : ''
                } ${
                  isMe
                    ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-xs'
                    : 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-xs'
                }`}
              >
                {/* Author Name in Group Chats (for others' messages) */}
                {!isMe && (
                  <div className={`text-[11px] font-extrabold mb-0.5 ${getAuthorColor(authorName)}`}>
                    {authorName}
                  </div>
                )}

                {/* Inline Message Editor */}
                {isEditing ? (
                  <div className="space-y-2 py-1 min-w-[200px] sm:min-w-[260px]">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={2}
                      className="w-full p-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-[#111b21] dark:text-[#e9edef] focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                    {editError && (
                      <div className="text-[10px] text-red-500 font-bold">{editError}</div>
                    )}
                    <div className="flex justify-end space-x-1.5">
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSavingEdit}
                        className="px-2 py-0.5 text-[11px] rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleSaveEdit(msg.rw_id)}
                        disabled={isSavingEdit || !editingText.trim()}
                        className="px-2.5 py-0.5 text-[11px] font-bold rounded bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      >
                        {isSavingEdit ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Message Text Content */}
                    <p className="text-xs leading-relaxed break-words whitespace-pre-wrap select-text">
                      {msg.rw_content || msg.content}
                    </p>

                    {/* Metadata: Time + Edited Flag + WhatsApp Double Check Status */}
                    <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] text-[#667781] dark:text-[#8696a0] select-none">
                      {isEdited && <span className="italic opacity-80 mr-1">(editado)</span>}
                      <span>{timestamp}</span>

                      {/* WhatsApp Checks Indicator for My Messages */}
                      {isMe && (
                        <span className="ml-0.5">
                          {isPending && <Clock size={11} className="text-neutral-400 animate-pulse" />}
                          {isFailed && (
                            <button
                              onClick={() => onRetryMessage(msg)}
                              className="text-red-500 flex items-center space-x-0.5 hover:underline cursor-pointer"
                              title="Reintentar envío"
                            >
                              <AlertCircle size={12} />
                            </button>
                          )}
                          {!isPending && !isFailed && (
                            (msg.reads_count > 0 || msg.read) ? (
                              <CheckCheck size={13} className="text-[#53bdeb] dark:text-[#53bdeb]" title="Leído" />
                            ) : (
                              <CheckCheck size={13} className="text-neutral-400" title="Entregado" />
                            )
                          )}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* Message Hover Actions: Edit and Soft Delete for Author's Messages */}
                {isMe && !isPending && !isEditing && (
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5 bg-white/90 dark:bg-neutral-800/90 rounded-md shadow-xs px-1 py-0.5 border border-neutral-200 dark:border-neutral-700">
                    <button
                      onClick={() => handleStartEdit(msg)}
                      className="p-1 rounded text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                      title="Editar mensaje"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => onDeleteMessage(msg.rw_id)}
                      className="p-1 rounded text-neutral-500 hover:text-red-500 cursor-pointer"
                      title={t.deleteMessage}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer Input (WhatsApp Style Bottom Bar) */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-neutral-300 dark:border-neutral-800 flex items-center space-x-2 z-10"
      >
        <div className="flex-1 relative">
          <textarea
            ref={composerInputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.typeMessagePlaceholder}
            className="w-full px-4 py-2 text-xs rounded-xl bg-white dark:bg-[#2a3942] border border-neutral-200 dark:border-neutral-700 text-[#111b21] dark:text-[#e9edef] placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-black flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm shrink-0"
          title={t.sendBtn}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
