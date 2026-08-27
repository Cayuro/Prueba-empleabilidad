import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api } from './services/api';
import { wsService } from './services/websocket';
import Header from './components/Header';
import ZoneConversations from './components/ZoneConversations';
import ZoneChat from './components/ZoneChat';
import ZoneCopilot from './components/ZoneCopilot';
import UserProfileModal from './components/UserProfileModal';
import LoginModal from './components/LoginModal';

// Root Main Layout Component
function MainApp() {
  const { user, token, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  // Zone 1 & 2 state: channels and active chat
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);

  // Zone 3 state: Copilot RAG queries and usage
  const [copilotHistory, setCopilotHistory] = useState([]);
  const [usageStats, setUsageStats] = useState(null);
  const [isQueryingCopilot, setIsQueryingCopilot] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // Zone 4 modal state
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Connect WebSocket STOMP client on login/mount
  useEffect(() => {
    if (isAuthenticated && token && typeof token === 'string' && token.startsWith('ey') && token.split('.').length === 3) {
      wsService.connect(token);
    } else {
      wsService.disconnect();
    }
    return () => {
      wsService.disconnect();
    };
  }, [isAuthenticated, token]);

  // Load user accessible channels and copilot usage
  const loadChannelsAndStats = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    setIsLoadingChannels(true);
    try {
      const [channelsData, statsData] = await Promise.all([
        api.getConversations(token),
        api.getCopilotUsage(token),
      ]);
      setChannels(channelsData || []);
      setUsageStats(statsData || { total_queries: 0, total_tokens: 0 });

      // Default select first channel if none selected or if active is no longer accessible
      if (channelsData && channelsData.length > 0) {
        setActiveChannel((prev) => {
          if (!prev) {
            const first = channelsData[0];
            return { ...first, rw_id: first.rw_channel_id || first.rw_id, rw_name: first.rw_channel_name || first.rw_name };
          }
          const prevId = prev.rw_channel_id || prev.rw_id;
          const exists = channelsData.find((c) => (c.rw_channel_id || c.rw_id) === prevId);
          if (exists) {
            return { ...exists, rw_id: exists.rw_channel_id || exists.rw_id, rw_name: exists.rw_channel_name || exists.rw_name };
          }
          const first = channelsData[0];
          return { ...first, rw_id: first.rw_channel_id || first.rw_id, rw_name: first.rw_channel_name || first.rw_name };
        });
      } else {
        setActiveChannel(null);
      }
    } catch (e) {
      console.error('Error loading channels:', e);
    } finally {
      setIsLoadingChannels(false);
    }
  }, [isAuthenticated, token]);

  // Strict session isolation: purge all in-memory state whenever user identity changes or on logout
  useEffect(() => {
    setChannels([]);
    setActiveChannel(null);
    setMessages([]);
    setCopilotHistory([]);
    setUsageStats(null);
    setHighlightedMessageId(null);
    setIsProfileOpen(false);

    if (isAuthenticated && token) {
      loadChannelsAndStats();
    }
  }, [user?.id, isAuthenticated, token, loadChannelsAndStats]);

  // Load message history when active channel switches
  useEffect(() => {
    if (!activeChannel || !isAuthenticated || !token) {
      setMessages([]);
      return;
    }

    const channelId = activeChannel.rw_channel_id || activeChannel.rw_id;
    let isMounted = true;
    setIsLoadingHistory(true);
    // Purge messages immediately so previous channel's chat is not visible
    setMessages([]);

    api.getMessages(channelId, { limit: 30 }, token)
      .then((history) => {
        if (!isMounted) return;
        // Reverse DESC database keyset result to ASC for natural chronological display
        setMessages(history ? [...history].reverse() : []);
        setHasMoreHistory((history || []).length >= 30);
      })
      .catch((e) => console.error('Error loading messages:', e))
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    // Real-time WebSocket subscription for active channel
    const unsubscribeWs = wsService.subscribeChannel(channelId, (incomingMsg) => {
      // Guard: strictly ignore messages belonging to other channels
      if (incomingMsg.rw_channel_id && incomingMsg.rw_channel_id !== channelId) return;

      setMessages((prev) => {
        // 1. If incoming message already exists by UUID, update it
        if (prev.some((m) => m.rw_id === incomingMsg.rw_id)) {
          return prev.map((m) => (m.rw_id === incomingMsg.rw_id ? { ...incomingMsg, status: 'sent' } : m));
        }

        // 2. If an optimistic pending message from this user with the same content exists, replace it
        const pendingIndex = prev.findIndex(
          (m) =>
            m.status === 'pending' &&
            m.rw_content === incomingMsg.rw_content &&
            m.rw_author_id === incomingMsg.rw_author_id
        );
        if (pendingIndex !== -1) {
          const next = [...prev];
          next[pendingIndex] = { ...incomingMsg, status: 'sent' };
          return next;
        }

        // 3. Otherwise append new incoming message
        return [...prev, incomingMsg];
      });

      // Mark incoming message as read automatically
      api.markRead(channelId, incomingMsg.rw_id, token);
    });

    return () => {
      isMounted = false;
      unsubscribeWs();
    };
  }, [activeChannel?.rw_id, activeChannel?.rw_channel_id, isAuthenticated, token]);

  // Load earlier messages using Keyset pagination: (rw_created_at, rw_id)
  const handleLoadOlderMessages = async () => {
    if (!activeChannel || messages.length === 0 || isLoadingHistory) return;
    setIsLoadingHistory(true);

    const channelId = activeChannel.rw_channel_id || activeChannel.rw_id;
    // Since messages are sorted ASC (oldest at index 0), the cursor is messages[0]
    const oldestMsg = messages[0];
    try {
      const older = await api.getMessages(
        channelId,
        {
          cursor_created_at: oldestMsg.rw_created_at,
          cursor_id: oldestMsg.rw_id,
          limit: 20,
        },
        token
      );
      if (older && older.length > 0) {
        // Reverse older batch to ASC and prepend to top
        const olderAsc = [...older].reverse();
        setMessages((prev) => [...olderAsc, ...prev]);
        setHasMoreHistory(older.length >= 20);
      } else {
        setHasMoreHistory(false);
      }
    } catch (e) {
      console.error('Error loading older messages:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Dispatch message with pending -> sent / failed states
  const handleSendMessage = async (content) => {
    if (!activeChannel) return;
    const channelId = activeChannel.rw_channel_id || activeChannel.rw_id;

    // Temporary optimistic pending message
    const tempId = 'temp_' + Date.now();
    const optimisticMsg = {
      rw_id: tempId,
      rw_channel_id: channelId,
      rw_author_id: user?.id,
      author_name: user?.name,
      rw_content: content,
      rw_created_at: new Date().toISOString(),
      status: 'pending',
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const savedMsg = await api.sendMessage(channelId, content, token);
      // Replace optimistic message or deduplicate if already added via WebSocket
      setMessages((prev) => {
        if (prev.some((m) => m.rw_id === savedMsg.rw_id)) {
          return prev.filter((m) => m.rw_id !== tempId);
        }
        return prev.map((m) => (m.rw_id === tempId ? { ...savedMsg, status: 'sent' } : m));
      });
      // Refresh channels last message preview
      loadChannelsAndStats();
    } catch {
      // Mark as failed to allow user retry
      setMessages((prev) =>
        prev.map((m) => (m.rw_id === tempId ? { ...m, status: 'failed' } : m))
      );
    }
  };

  // Retry sending a previously failed message
  const handleRetryMessage = async (msg) => {
    if (!activeChannel) return;
    const channelId = activeChannel.rw_channel_id || activeChannel.rw_id;

    setMessages((prev) =>
      prev.map((m) => (m.rw_id === msg.rw_id ? { ...m, status: 'pending' } : m))
    );
    try {
      const savedMsg = await api.sendMessage(channelId, msg.rw_content, token);
      setMessages((prev) =>
        prev.map((m) => (m.rw_id === msg.rw_id ? { ...savedMsg, status: 'sent' } : m))
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.rw_id === msg.rw_id ? { ...m, status: 'failed' } : m))
      );
    }
  };

  // Soft delete a message
  const handleDeleteMessage = async (messageId) => {
    if (!activeChannel) return;
    const channelId = activeChannel.rw_channel_id || activeChannel.rw_id;
    try {
      await api.deleteMessage(channelId, messageId, token);
      setMessages((prev) => prev.filter((m) => m.rw_id !== messageId));
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  // Edit/update an existing message
  const handleEditMessage = async (messageId, newContent) => {
    if (!activeChannel) return { success: false };
    const channelId = activeChannel.rw_channel_id || activeChannel.rw_id;
    try {
      await api.updateMessage(channelId, messageId, newContent, token);
      setMessages((prev) =>
        prev.map((m) => (m.rw_id === messageId ? { ...m, rw_content: newContent, rw_updated_at: new Date().toISOString() } : m))
      );
      return { success: true };
    } catch (e) {
      console.error('Update error:', e);
      return { success: false, error: 'Error al actualizar el mensaje' };
    }
  };

  // Create a new channel with optional initial members
  const handleCreateChannel = async (channelData) => {
    const { member_ids, ...data } = channelData;
    const newChan = await api.createChannel(data, token);
    if (newChan) {
      const id = newChan.rw_id || newChan.rw_channel_id;
      if (Array.isArray(member_ids) && member_ids.length > 0) {
        for (const memberId of member_ids) {
          try {
            await api.addChannelMember(id, memberId, 'member', token);
          } catch (err) {
            console.error('Error adding initial member to new channel:', err);
          }
        }
      }
      await loadChannelsAndStats();
      const name = newChan.rw_name || newChan.rw_channel_name;
      setActiveChannel({
        ...newChan,
        rw_id: id,
        rw_channel_id: id,
        rw_name: name,
        rw_channel_name: name,
      });
    }
  };

  // Ask Copilot AI query
  const handleQueryCopilot = async (queryText) => {
    setIsQueryingCopilot(true);
    try {
      const result = await api.queryCopilot(queryText, 5, token);
      const newEntry = {
        query: queryText,
        answer: result.answer,
        answer_found: result.answer_found !== undefined ? result.answer_found : !result.answer?.includes('⚠️ No encontré esa información'),
        citations: result.citations || [],
        tokens_used: result.tokens_used || 0,
        system_prompt_version: result.system_prompt_version || 1,
      };
      // Append to the bottom so questions appear in natural chronological order
      setCopilotHistory((prev) => [...prev, newEntry]);

      // Update token usage metrics dynamically
      const updatedStats = await api.getCopilotUsage(token);
      setUsageStats(updatedStats);
    } catch (e) {
      console.error('Copilot query error:', e);
    } finally {
      setIsQueryingCopilot(false);
    }
  };

  // Select citation and highlight corresponding message in chat
  const handleSelectCitation = (messageId) => {
    setHighlightedMessageId(messageId);
    // Remove highlight after 4 seconds
    setTimeout(() => {
      setHighlightedMessageId(null);
    }, 4000);
  };

  // Collapsible zones state (on small screens start with copilot closed)
  const [showChannels, setShowChannels] = useState(true);
  const [showCopilot, setShowCopilot] = useState(false);

  // Toggle channels smoothly across mobile and desktop
  const handleToggleChannels = () => {
    setShowChannels((prev) => {
      const next = !prev;
      if (next && typeof window !== 'undefined' && window.innerWidth < 768) {
        setShowCopilot(false);
      }
      return next;
    });
  };

  // Toggle copilot smoothly across mobile and desktop
  const handleToggleCopilot = () => {
    setShowCopilot((prev) => {
      const next = !prev;
      if (next && typeof window !== 'undefined' && window.innerWidth < 768) {
        setShowChannels(false);
      }
      return next;
    });
  };

  // Channel selection with mobile drawer auto-close
  const handleSelectChannel = (chan) => {
    setActiveChannel(chan);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowChannels(false);
      setShowCopilot(false);
    }
  };

  if (!isAuthenticated) {
    return <LoginModal />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text transition-colors duration-200">
      {/* Top Application Header with zone toggles */}
      <Header
        onOpenProfile={() => setIsProfileOpen(true)}
        showChannels={showChannels}
        onToggleChannels={handleToggleChannels}
        showCopilot={showCopilot}
        onToggleCopilot={handleToggleCopilot}
      />

      {/* Dynamic Collapsible 3-Zone Layout */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Zone 1: Conversations & Channels List */}
        {showChannels && (
          <section className={`h-full overflow-hidden border-r border-light-border dark:border-dark-border transition-all duration-200 ${
            showCopilot ? 'hidden md:block md:w-72 lg:w-80 shrink-0' : 'w-full md:w-72 lg:w-80 shrink-0'
          }`}>
            <ZoneConversations
              channels={channels}
              activeChannelId={activeChannel?.rw_id}
              onSelectChannel={handleSelectChannel}
              onCreateChannel={handleCreateChannel}
              isLoading={isLoadingChannels}
            />
          </section>
        )}

        {/* Zone 2: Chat Stream & Message History */}
        {(!showCopilot || (typeof window !== 'undefined' && window.innerWidth >= 768)) && 
         (!showChannels || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
          <section className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
            <ZoneChat
              activeChannel={activeChannel}
              messages={messages}
              isLoadingHistory={isLoadingHistory}
              onSendMessage={handleSendMessage}
              onRetryMessage={handleRetryMessage}
              onDeleteMessage={handleDeleteMessage}
              onEditMessage={handleEditMessage}
              onLoadOlderMessages={handleLoadOlderMessages}
              hasMoreHistory={hasMoreHistory}
              highlightedMessageId={highlightedMessageId}
              onBackToChannels={() => {
                setShowChannels(true);
                setShowCopilot(false);
              }}
            />
          </section>
        )}

        {/* Zone 3: Copilot AI Assistant Panel */}
        {showCopilot && (
          <section className="w-full md:w-80 lg:w-[400px] shrink-0 h-full overflow-hidden border-l border-light-border dark:border-dark-border transition-all duration-200">
            <ZoneCopilot
              onSelectCitation={(msgId) => {
                handleSelectCitation(msgId);
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setShowCopilot(false);
                  setShowChannels(false);
                }
              }}
              onQueryCopilot={handleQueryCopilot}
              copilotHistory={copilotHistory}
              usageStats={usageStats}
              isQuerying={isQueryingCopilot}
            />
          </section>
        )}
      </main>

      {/* Zone 4: User Profile & Session Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        usageStats={usageStats}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
