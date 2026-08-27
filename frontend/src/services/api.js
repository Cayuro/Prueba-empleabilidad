// Real REST API client connecting strictly to Spring Boot Thin Backend with Correlation IDs, JWT Bearer and automatic Token Rotation Interceptor

// Generate UUID v4 for correlation header
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(newToken) {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback) {
  refreshSubscribers.push(callback);
}

// Transparent token refresh helper
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('rw_refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-Id': generateUUID(),
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    localStorage.removeItem('rw_access_token');
    localStorage.removeItem('rw_refresh_token');
    localStorage.removeItem('rw_user');
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Session expired');
  }

  const data = await res.json();
  localStorage.setItem('rw_access_token', data.access_token);
  localStorage.setItem('rw_refresh_token', data.refresh_token);
  return data.access_token;
}

// Generic HTTP fetcher with Bearer auth, X-Correlation-Id header, and automatic 401 retry
async function request(endpoint, options = {}, token = null, isRetry = false) {
  const correlationId = generateUUID();
  const currentToken = token || localStorage.getItem('rw_access_token');

  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': correlationId,
    ...(options.headers || {}),
  };

  if (currentToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  // Intercept 401 Unauthorized for silent token refresh
  if (response.status === 401 && !isRetry && !endpoint.includes('/api/auth/')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        onRefreshed(newToken);
        return await request(endpoint, options, newToken, true);
      } catch (err) {
        isRefreshing = false;
        throw err;
      }
    } else {
      return new Promise((resolve, reject) => {
        addRefreshSubscriber(async (newToken) => {
          try {
            const res = await request(endpoint, options, newToken, true);
            resolve(res);
          } catch (e) {
            reject(e);
          }
        });
      });
    }
  }

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    const error = new Error(errorData.message || 'API request failed');
    error.status = response.status;
    error.correlationId = response.headers.get('X-Correlation-Id') || correlationId;
    error.data = errorData;
    throw error;
  }

  return response.json();
}

// Real REST API Service Methods directly communicating with PostgreSQL through Spring Boot
export const api = {
  // Fetch user conversations from rw_vw_user_conversations filtered by PostgreSQL RLS
  async getConversations(token) {
    try {
      const data = await request('/api/conversations', { method: 'GET' }, token);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('Error fetching conversations:', e);
      return [];
    }
  },

  // List all accessible channels under RLS
  async getChannels(token) {
    try {
      const data = await request('/api/channels', { method: 'GET' }, token);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('Error fetching channels:', e);
      return [];
    }
  },

  // Create a new channel
  async createChannel(channelData, token) {
    return await request('/api/channels', {
      method: 'POST',
      body: JSON.stringify(channelData),
    }, token);
  },

  // Keyset Pagination for message stream without OFFSET (D-06)
  async getMessages(channelId, cursor_created_at = null, cursor_id = null, limit = 30, token = null) {
    try {
      const params = new URLSearchParams();
      if (cursor_created_at) params.append('cursor_created_at', cursor_created_at);
      if (cursor_id) params.append('cursor_id', cursor_id);
      params.append('limit', limit);
      const data = await request(`/api/channels/${channelId}/messages?${params.toString()}`, { method: 'GET' }, token);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error(`Error loading messages for channel ${channelId}:`, e);
      return [];
    }
  },

  // Post a new message
  async sendMessage(channelId, content, token) {
    return await request(`/api/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }, token);
  },

  // Soft delete message
  async deleteMessage(channelId, messageId, token) {
    return await request(`/api/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE'
    }, token);
  },

  // Edit/update message content
  async updateMessage(channelId, messageId, content, token) {
    return await request(`/api/channels/${channelId}/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }, token);
  },

  // Mark message as read
  async markRead(channelId, messageId, token) {
    try {
      return await request(`/api/channels/${channelId}/messages/${messageId}/read`, {
        method: 'POST'
      }, token);
    } catch {
      return null;
    }
  },

  // Query users in platform for invitations
  async getUsers(search = '', token) {
    try {
      const data = await request(`/api/users?search=${encodeURIComponent(search)}`, { method: 'GET' }, token);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('Error fetching users:', e);
      return [];
    }
  },

  // Get members of a channel
  async getChannelMembers(channelId, token) {
    try {
      const data = await request(`/api/channels/${channelId}/members`, { method: 'GET' }, token);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('Error fetching channel members:', e);
      return [];
    }
  },

  // Add/invite a member to a channel
  async addChannelMember(channelId, userId, role = 'member', token) {
    return await request(`/api/channels/${channelId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    }, token);
  },

  // Full-text search with ts_headline across authorized channels under PostgreSQL RLS
  async searchMessages(query, limit = 20, token) {
    try {
      const data = await request(`/api/messages/search?q=${encodeURIComponent(query)}&limit=${limit}`, { method: 'GET' }, token);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('Error searching messages:', e);
      return [];
    }
  },

  // Query Copilot RAG endpoint
  async queryCopilot(query, retrievalLimit = 5, token) {
    return await request('/api/copilot/query', {
      method: 'POST',
      body: JSON.stringify({ query, retrieval_limit: retrievalLimit }),
    }, token);
  },

  // Get Copilot token usage metrics
  async getCopilotUsage(token) {
    try {
      return await request('/api/copilot/usage', { method: 'GET' }, token);
    } catch (e) {
      console.error('Error fetching Copilot usage:', e);
      return { total_queries: 0, total_tokens: 0 };
    }
  },
};
