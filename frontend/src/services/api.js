// Real REST API client connecting strictly to Spring Boot Thin Backend with Correlation IDs and JWT Bearer

// Generate UUID v4 for correlation header
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generic HTTP fetcher with Bearer auth and X-Correlation-Id header
async function request(endpoint, options = {}, token = null) {
  const correlationId = generateUUID();
  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': correlationId,
    ...(options.headers || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
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

  // Create a new channel
  async createChannel(channelData, token) {
    return await request('/api/channels', {
      method: 'POST',
      body: JSON.stringify(channelData),
    }, token);
  },

  // Keyset paginated messages fetcher: (rw_created_at, rw_id) under PostgreSQL RLS
  async getMessages(channelId, { cursor_created_at, cursor_id, limit = 30 } = {}, token) {
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

  // Query Copilot RAG endpoint
  async queryCopilot(query, retrievalLimit = 5, token) {
    return await request('/api/copilot/query', {
      method: 'POST',
      body: JSON.stringify({ query, retrieval_limit: retrievalLimit }),
    }, token);
  },

  // Copilot usage statistics dynamically fetched for currently authenticated user from PostgreSQL
  async getCopilotUsage(token) {
    try {
      return await request('/api/copilot/usage', { method: 'GET' }, token);
    } catch (e) {
      console.error('Error fetching copilot usage:', e);
      return { total_queries: 0, total_tokens: 0, last_query_at: null };
    }
  }
};
