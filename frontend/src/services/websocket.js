import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

// WebSocket STOMP client manager for real-time messaging
class WebSocketService {
  constructor() {
    this.client = null;
    this.status = 'DISCONNECTED'; // 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
    this.statusListeners = new Set();
    this.channelSubscriptions = new Map();
  }

  // Register listener for connection status changes
  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  // Update status and notify all registered listeners
  _setStatus(newStatus) {
    this.status = newStatus;
    this.statusListeners.forEach((cb) => cb(newStatus));
  }

  // Connect to the Spring Boot STOMP broker at /ws
  connect(token) {
    if (this.client && this.client.active) {
      return;
    }

    this._setStatus('CONNECTING');

    this.client = new Client({
      // Provide SockJS fallback factory
      webSocketFactory: () => new SockJS('/ws'),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      debug: (str) => {
        // One-line debug logger for WebSocket frames
        // console.log('[STOMP]:', str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: (frame) => {
        this._setStatus('CONNECTED');
        // Resubscribe to active channels if reconnected
        this.channelSubscriptions.forEach((subData, channelId) => {
          this._subscribeToTopic(channelId, subData.callback);
        });
      },
      onStompError: (frame) => {
        console.error('[STOMP Error]:', frame.headers['message'], frame.body);
        this._setStatus('ERROR');
      },
      onWebSocketClose: () => {
        this._setStatus('DISCONNECTED');
      },
      onWebSocketError: (event) => {
        console.warn('[WebSocket Warning]: Connection failed, retrying in background.');
        this._setStatus('DISCONNECTED');
      }
    });

    try {
      this.client.activate();
    } catch (e) {
      this._setStatus('ERROR');
    }
  }

  // Subscribe to channel topic: /topic/channels/{channelId}
  subscribeChannel(channelId, onMessageReceived) {
    this.channelSubscriptions.set(channelId, { callback: onMessageReceived, subscription: null });

    if (this.client && this.client.connected) {
      this._subscribeToTopic(channelId, onMessageReceived);
    }

    // Return un-subscribe cleanup handler
    return () => {
      const subData = this.channelSubscriptions.get(channelId);
      if (subData && subData.subscription) {
        subData.subscription.unsubscribe();
      }
      this.channelSubscriptions.delete(channelId);
    };
  }

  // Internal helper to perform STOMP subscription
  _subscribeToTopic(channelId, callback) {
    try {
      const sub = this.client.subscribe(`/topic/channels/${channelId}`, (message) => {
        try {
          const payload = JSON.parse(message.body);
          callback(payload);
        } catch {
          callback(message.body);
        }
      });
      const existing = this.channelSubscriptions.get(channelId);
      if (existing) {
        existing.subscription = sub;
      }
    } catch (e) {
      console.error('Subscription error for channel', channelId, e);
    }
  }

  // Disconnect STOMP client
  disconnect() {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      this._setStatus('DISCONNECTED');
      this.channelSubscriptions.clear();
    }
  }
}

// Singleton instance
export const wsService = new WebSocketService();
