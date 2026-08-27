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
    if (isAuthenticated) {
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
    if (!isAuthenticated) return;
    setIsLoadingChannels(true);
    try {
      const [channelsData, statsData] = await Promise.all([
        api.getConversations(token, user),
        api.getCopilotUsage(token),
      ]);
      setChannels(channelsData || []);
      setUsageStats(statsData || null);

      // Default select first channel if none selected or if active is no longer accessible
      if (channelsData && channelsData.length > 0) {
        setActiveChannel((prev) => {
          if (!prev) return channelsData[0];
          const exists = channelsData.find((c) => c.rw_id === prev.rw_id);
          return exists || channelsData[0];
        });
      } else {
        setActiveChannel(null);
      }
    } catch (e) {
      console.error('Error loading channels:', e);
    } finally {
      setIsLoadingChannels(false);
    }
  }, [isAuthenticated, token, user]);

  // Trigger channels fetch on auth change
  useEffect(() => {
    loadChannelsAndStats();
  }, [loadChannelsAndStats]);

  // Load message history when active channel switches
  useEffect(() => {
    if (!activeChannel || !isAuthenticated) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoadingHistory(true);

    api.getMessages(activeChannel.rw_id, { limit: 30 }, token)
      .then((history) => {
        if (!isMounted) return;
        setMessages(history || []);
        setHasMoreHistory((history || []).length >= 30);
      })
      .catch((e) => console.error('Error loading messages:', e))
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    // Real-time WebSocket subscription for active channel
    const unsubscribeWs = wsService.subscribeChannel(activeChannel.rw_id, (incomingMsg) => {
      setMessages((prev) => {
        // Prevent duplicate appending if message already exists
        if (prev.some((m) => m.rw_id === incomingMsg.rw_id)) {
          return prev.map((m) => (m.rw_id === incomingMsg.rw_id ? incomingMsg : m));
        }
        return [...prev, incomingMsg];
      });

      // Mark incoming message as read automatically
      api.markRead(activeChannel.rw_id, incomingMsg.rw_id, token);
    });

    return () => {
      isMounted = false;
      unsubscribeWs();
    };
  }, [activeChannel, isAuthenticated, token]);

  // Load earlier messages using Keyset pagination: (rw_created_at, rw_id)
  const handleLoadOlderMessages = async () => {
    if (!activeChannel || messages.length === 0 || isLoadingHistory) return;
    setIsLoadingHistory(true);

    const oldestMsg = messages[0];
    try {
      const older = await api.getMessages(
        activeChannel.rw_id,
        {
          cursor_created_at: oldestMsg.rw_created_at,
          cursor_id: oldestMsg.rw_id,
          limit: 20,
        },
        token
      );
      if (older && older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
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

    // Temporary optimistic pending message
    const tempId = 'temp_' + Date.now();
    const optimisticMsg = {
      rw_id: tempId,
      rw_channel_id: activeChannel.rw_id,
      rw_author_id: user?.id,
      author_name: user?.name,
      rw_content: content,
      rw_created_at: new Date().toISOString(),
      status: 'pending',
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const savedMsg = await api.sendMessage(activeChannel.rw_id, content, token, user);
      // Replace optimistic message with server-confirmed message
      setMessages((prev) =>
        prev.map((m) => (m.rw_id === tempId ? { ...savedMsg, status: 'sent' } : m))
      );
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
    setMessages((prev) =>
      prev.map((m) => (m.rw_id === msg.rw_id ? { ...m, status: 'pending' } : m))
    );
    try {
      const savedMsg = await api.sendMessage(activeChannel.rw_id, msg.rw_content, token, user);
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
    try {
      await api.deleteMessage(activeChannel.rw_id, messageId, token);
      setMessages((prev) => prev.filter((m) => m.rw_id !== messageId));
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  // Create a new channel
  const handleCreateChannel = async (channelData) => {
    const newChan = await api.createChannel(channelData, token, user);
    await loadChannelsAndStats();
    setActiveChannel(newChan);
  };

  // Ask Copilot AI query
  const handleQueryCopilot = async (queryText) => {
    setIsQueryingCopilot(true);
    try {
      const result = await api.queryCopilot(queryText, 5, token, user);
      const newEntry = {
        query: queryText,
        answer: result.answer,
        citations: result.citations || [],
        tokens_used: result.tokens_used || 0,
        system_prompt_version: result.system_prompt_version || 1,
      };
      setCopilotHistory((prev) => [newEntry, ...prev]);

      // Update token usage metrics
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

  if (!isAuthenticated) {
    return <LoginModal />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text transition-colors duration-200">
      {/* Top Application Header */}
      <Header onOpenProfile={() => setIsProfileOpen(true)} />

      {/* 3 Main Zones Layout */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        {/* Zone 1: Conversations & Channels List (3 cols) */}
        <section className="md:col-span-3 lg:col-span-3 h-full overflow-hidden">
          <ZoneConversations
            channels={channels}
            activeChannelId={activeChannel?.rw_id}
            onSelectChannel={setActiveChannel}
            onCreateChannel={handleCreateChannel}
            isLoading={isLoadingChannels}
          />
        </section>

        {/* Zone 2: Chat Stream & Message History (5-6 cols) */}
        <section className="md:col-span-5 lg:col-span-5 h-full overflow-hidden flex flex-col">
          <ZoneChat
            activeChannel={activeChannel}
            messages={messages}
            isLoadingHistory={isLoadingHistory}
            onSendMessage={handleSendMessage}
            onRetryMessage={handleRetryMessage}
            onDeleteMessage={handleDeleteMessage}
            onLoadOlderMessages={handleLoadOlderMessages}
            hasMoreHistory={hasMoreHistory}
            highlightedMessageId={highlightedMessageId}
          />
        </section>

        {/* Zone 3: Copilot AI Assistant Panel (4 cols) */}
        <section className="md:col-span-4 lg:col-span-4 h-full overflow-hidden">
          <ZoneCopilot
            onSelectCitation={handleSelectCitation}
            onQueryCopilot={handleQueryCopilot}
            copilotHistory={copilotHistory}
            usageStats={usageStats}
            isQuerying={isQueryingCopilot}
          />
        </section>
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
