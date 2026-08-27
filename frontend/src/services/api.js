// REST API client wrapper adhering to API contract and correlation IDs

// Generate UUID v4 for correlation header
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Initial mock data derived from seed.json for offline / stand-alone operation
let mockChannels = [
  {
    rw_id: "10000000-0000-0000-0000-000000000001",
    rw_name: "general",
    rw_is_private: false,
    unread_count: 0,
    last_message: "Saludos a todos. Preparando los módulos de backend...",
    last_message_at: "2026-08-01T11:10:00Z"
  },
  {
    rw_id: "10000000-0000-0000-0000-000000000002",
    rw_name: "desarrollo-dev",
    rw_is_private: false,
    unread_count: 1,
    last_message: "La mensajería en tiempo real funcionará mediante WebSocket con STOMP...",
    last_message_at: "2026-08-01T11:45:00Z"
  },
  {
    rw_id: "10000000-0000-0000-0000-000000000003",
    rw_name: "liderazgo-privado",
    rw_is_private: true,
    unread_count: 2,
    last_message: "[CONFIDENCIAL LIDERAZGO] Las métricas de desempeño y retención...",
    last_message_at: "2026-08-01T12:15:00Z"
  }
];

let mockMessages = {
  "10000000-0000-0000-0000-000000000001": [
    {
      rw_id: "20000000-0000-0000-0000-000000000001",
      rw_channel_id: "10000000-0000-0000-0000-000000000001",
      rw_author_id: "c0000000-0000-0000-0000-000000000001",
      author_name: "Carlos Mendoza",
      rw_content: "¡Bienvenidos todos a la nueva plataforma de mensajería interna de Riwi Co. S.A.S.! En este canal general compartiremos noticias institucionales.",
      rw_created_at: "2026-08-01T11:00:00Z",
      status: "sent",
      reads_count: 2
    },
    {
      rw_id: "20000000-0000-0000-0000-000000000002",
      rw_channel_id: "10000000-0000-0000-0000-000000000001",
      rw_author_id: "c0000000-0000-0000-0000-000000000002",
      author_name: "Valeria Gomez",
      rw_content: "Excelente Carlos. Todo el equipo de ingeniería está listo para colaborar y probar las funcionalidades de IA y mensajería en tiempo real.",
      rw_created_at: "2026-08-01T11:05:00Z",
      status: "sent",
      reads_count: 1
    },
    {
      rw_id: "20000000-0000-0000-0000-000000000003",
      rw_channel_id: "10000000-0000-0000-0000-000000000001",
      rw_author_id: "c0000000-0000-0000-0000-000000000003",
      author_name: "Santiago Restrepo",
      rw_content: "Saludos a todos. Preparando los módulos de backend con Spring Boot y PostgreSQL 15.",
      rw_created_at: "2026-08-01T11:10:00Z",
      status: "sent",
      reads_count: 1
    }
  ],
  "10000000-0000-0000-0000-000000000002": [
    {
      rw_id: "20000000-0000-0000-0000-000000000004",
      rw_channel_id: "10000000-0000-0000-0000-000000000002",
      rw_author_id: "c0000000-0000-0000-0000-000000000002",
      author_name: "Valeria Gomez",
      rw_content: "Equipo dev: el paradigma Smart Database establece que toda la lógica de autorización RLS, triggers y constraints viva en PostgreSQL. Nada de validaciones críticas en Java.",
      rw_created_at: "2026-08-01T11:30:00Z",
      status: "sent",
      reads_count: 1
    },
    {
      rw_id: "20000000-0000-0000-0000-000000000005",
      rw_channel_id: "10000000-0000-0000-0000-000000000002",
      rw_author_id: "c0000000-0000-0000-0000-000000000003",
      author_name: "Santiago Restrepo",
      rw_content: "De acuerdo Valeria. Implementé la paginación Keyset usando el cursor (rw_created_at, rw_id). Es O(log n) y no usamos OFFSET en ninguna consulta.",
      rw_created_at: "2026-08-01T11:35:00Z",
      status: "sent",
      reads_count: 1
    },
    {
      rw_id: "20000000-0000-0000-0000-000000000006",
      rw_channel_id: "10000000-0000-0000-0000-000000000002",
      rw_author_id: "c0000000-0000-0000-0000-000000000004",
      author_name: "Mariana Torres",
      rw_content: "Integré pgvector con embeddings de 1536 dimensiones para el Copilot RAG. El filtro RLS se aplica directamente en la base de datos protegiendo la privacidad de los canales.",
      rw_created_at: "2026-08-01T11:40:00Z",
      status: "sent",
      reads_count: 0
    },
    {
      rw_id: "20000000-0000-0000-0000-000000000007",
      rw_channel_id: "10000000-0000-0000-0000-000000000002",
      rw_author_id: "c0000000-0000-0000-0000-000000000002",
      author_name: "Valeria Gomez",
      rw_content: "La mensajería en tiempo real funcionará mediante WebSocket con protocolo STOMP suscrito a /topic/channels/{channelId}.",
      rw_created_at: "2026-08-01T11:45:00Z",
      status: "sent",
      reads_count: 0
    }
  ],
  "10000000-0000-0000-0000-000000000003": [
    {
      rw_id: "20000000-0000-0000-0000-000000000008",
      rw_channel_id: "10000000-0000-0000-0000-000000000003",
      rw_author_id: "c0000000-0000-0000-0000-000000000001",
      author_name: "Carlos Mendoza",
      rw_content: "[CONFIDENCIAL LIDERAZGO] Revisión estratégica del presupuesto Q3 y metas de empleabilidad para los coders de la cohorte 6.",
      rw_created_at: "2026-08-01T12:00:00Z",
      status: "sent",
      reads_count: 2
    },
    {
      rw_id: "20000000-0000-0000-0000-000000000009",
      rw_channel_id: "10000000-0000-0000-0000-000000000003",
      rw_author_id: "c0000000-0000-0000-0000-000000000005",
      author_name: "Alejandro Castro",
      rw_content: "[CONFIDENCIAL LIDERAZGO] Las métricas de desempeño y retención de talento muestran un incremento del 25% tras la adopción de los clanes.",
      rw_created_at: "2026-08-01T12:15:00Z",
      status: "sent",
      reads_count: 1
    }
  ]
};

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

// REST API Service Methods with Fallback Simulation
export const api = {
  // Fetch user conversations with unread counters
  async getConversations(token, currentUser) {
    try {
      const data = await request('/api/conversations', { method: 'GET' }, token);
      return data;
    } catch {
      // Mock filter channels based on user membership
      return mockChannels.filter(c => {
        if (!c.rw_is_private) return true;
        // Check if user is in private channel (Carlos, Alejandro, Valeria)
        const allowed = ['c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005'];
        return currentUser && allowed.includes(currentUser.id);
      });
    }
  },

  // Create a new channel
  async createChannel(channelData, token, currentUser) {
    try {
      return await request('/api/channels', {
        method: 'POST',
        body: JSON.stringify(channelData),
      }, token);
    } catch {
      const newChan = {
        rw_id: generateUUID(),
        rw_name: channelData.name,
        rw_is_private: !!channelData.is_private,
        rw_created_by: currentUser?.id,
        unread_count: 0,
        last_message: "",
        last_message_at: new Date().toISOString()
      };
      mockChannels.push(newChan);
      mockMessages[newChan.rw_id] = [];
      return newChan;
    }
  },

  // Keyset paginated messages fetcher: (rw_created_at, rw_id)
  async getMessages(channelId, { cursor_created_at, cursor_id, limit = 20 } = {}, token) {
    try {
      const params = new URLSearchParams();
      if (cursor_created_at) params.append('cursor_created_at', cursor_created_at);
      if (cursor_id) params.append('cursor_id', cursor_id);
      params.append('limit', limit);
      return await request(`/api/channels/${channelId}/messages?${params.toString()}`, { method: 'GET' }, token);
    } catch {
      const list = mockMessages[channelId] || [];
      return list;
    }
  },

  // Post a new message
  async sendMessage(channelId, content, token, currentUser) {
    try {
      return await request(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }, token);
    } catch {
      const msg = {
        rw_id: generateUUID(),
        rw_channel_id: channelId,
        rw_author_id: currentUser?.id || "c0000000-0000-0000-0000-000000000001",
        author_name: currentUser?.name || "CurrentUser",
        rw_content: content,
        rw_created_at: new Date().toISOString(),
        status: "sent",
        reads_count: 0
      };
      if (!mockMessages[channelId]) mockMessages[channelId] = [];
      mockMessages[channelId].push(msg);
      return msg;
    }
  },

  // Soft delete message
  async deleteMessage(channelId, messageId, token) {
    try {
      return await request(`/api/channels/${channelId}/messages/${messageId}`, {
        method: 'DELETE'
      }, token);
    } catch {
      if (mockMessages[channelId]) {
        mockMessages[channelId] = mockMessages[channelId].filter(m => m.rw_id !== messageId);
      }
      return null;
    }
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

  // Query Copilot RAG endpoint
  async queryCopilot(query, retrievalLimit = 5, token, currentUser) {
    try {
      return await request('/api/copilot/query', {
        method: 'POST',
        body: JSON.stringify({ query, retrieval_limit: retrievalLimit }),
      }, token);
    } catch {
      // Dynamic simulated RAG answer based on query keywords and user permissions
      const qLower = query.toLowerCase();
      
      // Check leadership access
      const isLeader = currentUser && ['c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005'].includes(currentUser.id);
      
      if (qLower.includes('liderazgo') || qLower.includes('presupuesto') || qLower.includes('estrategia') || qLower.includes('confidencial')) {
        if (!isLeader) {
          return {
            answer: "Contexto autorizado insuficiente para responder a esta consulta. La política RLS protege canales privados.",
            used_message_ids: [],
            citations: [],
            tokens_used: 12,
            system_prompt_version: 1
          };
        } else {
          return {
            answer: "En la reunión de liderazgo se acordó la revisión estratégica del presupuesto Q3 y metas de empleabilidad para los coders de la cohorte 6, observando un incremento del 25% tras la adopción de los clanes.",
            used_message_ids: ["20000000-0000-0000-0000-000000000008", "20000000-0000-0000-0000-000000000009"],
            citations: [
              {
                message_id: "20000000-0000-0000-0000-000000000008",
                snippet: "Revisión estratégica del presupuesto Q3 y metas de empleabilidad para los coders..."
              },
              {
                message_id: "20000000-0000-0000-0000-000000000009",
                snippet: "Las métricas de desempeño y retención de talento muestran un incremento del 25%..."
              }
            ],
            tokens_used: 185,
            system_prompt_version: 1
          };
        }
      }

      if (qLower.includes('borrado') || qLower.includes('delete') || qLower.includes('smart database') || qLower.includes('keyset') || qLower.includes('pgvector')) {
        return {
          answer: "La arquitectura Smart Database establece que toda la lógica de autorización RLS, triggers y constraints reside en PostgreSQL. El borrado es estrictamente lógico (rw_deleted_at = NOW(), rw_is_active = FALSE) con ON DELETE RESTRICT, y la paginación se realiza mediante Keyset (rw_created_at, rw_id).",
          used_message_ids: ["20000000-0000-0000-0000-000000000004", "20000000-0000-0000-0000-000000000005", "20000000-0000-0000-0000-000000000006"],
          citations: [
            {
              message_id: "20000000-0000-0000-0000-000000000004",
              snippet: "El paradigma Smart Database establece que toda la lógica de autorización RLS vive en PostgreSQL."
            },
            {
              message_id: "20000000-0000-0000-0000-000000000005",
              snippet: "Paginación Keyset usando el cursor (rw_created_at, rw_id) en O(log n)."
            }
          ],
          tokens_used: 164,
          system_prompt_version: 1
        };
      }

      return {
        answer: `En base a los mensajes analizados en los canales activos, el equipo está trabajando activamente en la plataforma de mensajería interna con PostgreSQL 15, Spring Boot y React.`,
        used_message_ids: ["20000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000002"],
        citations: [
          {
            message_id: "20000000-0000-0000-0000-000000000001",
            snippet: "¡Bienvenidos todos a la nueva plataforma de mensajería interna de Riwi Co. S.A.S.!"
          }
        ],
        tokens_used: 118,
        system_prompt_version: 1
      };
    }
  },

  // Copilot usage statistics
  async getCopilotUsage(token) {
    try {
      return await request('/api/copilot/usage', { method: 'GET' }, token);
    } catch {
      return {
        total_queries: 4,
        total_tokens: 589,
        last_query_at: new Date().toISOString()
      };
    }
  }
};
