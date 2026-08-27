import React, { createContext, useContext, useState, useEffect } from 'react';

// 10 Demo users from seed data for quick testing and permission checks
export const DEMO_USERS = [
  {
    id: "c0000000-0000-0000-0000-000000000001",
    email: "admin@riwi.io",
    password: "RiwiAdmin2026!",
    name: "Carlos Mendoza",
    role: "admin",
    description: "Admin global (supervisión completa de todos los canales)",
  },
  {
    id: "c0000000-0000-0000-0000-000000000005",
    email: "alejandro.lead@riwi.io",
    password: "RiwiDev2026!",
    name: "Alejandro Castro",
    role: "admin",
    description: "Admin global (supervisión y liderazgo)",
  },
  {
    id: "c0000000-0000-0000-0000-000000000002",
    email: "valeria.dev@riwi.io",
    password: "RiwiDev2026!",
    name: "Valeria Gomez",
    role: "member",
    description: "Miembro (Liderazgo + Frontend + Dev)",
  },
  {
    id: "c0000000-0000-0000-0000-000000000003",
    email: "santiago.coder@riwi.io",
    password: "RiwiDev2026!",
    name: "Santiago Restrepo",
    role: "member",
    description: "Miembro (Frontend + Dev - NO liderazgo)",
  },
  {
    id: "c0000000-0000-0000-0000-000000000007",
    email: "camila.ux@riwi.io",
    password: "RiwiDev2026!",
    name: "Camila Vargas",
    role: "member",
    description: "Miembro (Frontend UI - NO liderazgo)",
  },
  {
    id: "c0000000-0000-0000-0000-000000000004",
    email: "mariana.ai@riwi.io",
    password: "RiwiDev2026!",
    name: "Mariana Torres",
    role: "member",
    description: "Miembro (Públicos: General y Dev)",
  },
  {
    id: "c0000000-0000-0000-0000-000000000006",
    email: "esteban.qa@riwi.io",
    password: "RiwiDev2026!",
    name: "Esteban Morales",
    role: "member",
    description: "Miembro (QA - Sin canales privados)",
  },
  {
    id: "c0000000-0000-0000-0000-000000000008",
    email: "mateo.backend@riwi.io",
    password: "RiwiDev2026!",
    name: "Mateo Rueda",
    role: "member",
    description: "Miembro (Backend - Sin canales privados)",
  },
  {
    id: "c0000000-0000-0000-0000-000000000009",
    email: "lucia.cloud@riwi.io",
    password: "RiwiDev2026!",
    name: "Lucia Herrera",
    role: "member",
    description: "Miembro (Solo General - Comprobar bloqueo)",
  },
  {
    id: "c0000000-0000-0000-0000-000000000010",
    email: "diego.coder@riwi.io",
    password: "RiwiDev2026!",
    name: "Diego Ospina",
    role: "member",
    description: "Miembro (Solo General - Comprobar bloqueo)",
  },
];

const AuthContext = createContext(null);

const isValidJwt = (t) => {
  return typeof t === 'string' && t.startsWith('ey') && t.split('.').length === 3;
};

export function AuthProvider({ children }) {
  // Current logged in user object
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('rw_user');
      const savedToken = localStorage.getItem('rw_access_token');
      if (saved && isValidJwt(savedToken)) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore JSON parse error
    }
    localStorage.removeItem('rw_user');
    localStorage.removeItem('rw_access_token');
    localStorage.removeItem('rw_refresh_token');
    return null;
  });

  // JWT Access token for backend REST requests
  const [token, setToken] = useState(() => {
    const savedToken = localStorage.getItem('rw_access_token');
    return isValidJwt(savedToken) ? savedToken : null;
  });
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('rw_refresh_token') || null);

  // Listen for session expiry event from API interceptor
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setToken(null);
      setRefreshToken(null);
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  // Sync auth state to localStorage
  useEffect(() => {
    if (user && isValidJwt(token)) {
      localStorage.setItem('rw_user', JSON.stringify(user));
      localStorage.setItem('rw_access_token', token);
    } else if (!user) {
      localStorage.removeItem('rw_user');
      localStorage.removeItem('rw_access_token');
      localStorage.removeItem('rw_refresh_token');
    }
  }, [user, token]);

  // Login handler contacting backend /api/auth/login
  const login = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        setRefreshToken(data.refresh_token);
        localStorage.setItem('rw_access_token', data.access_token);
        localStorage.setItem('rw_refresh_token', data.refresh_token);

        const userData = data.user || {
          id: data.user_id,
          email,
          name: email.split('@')[0],
          role: 'member',
        };
        setUser(userData);
        return { success: true };
      } else {
        const err = await res.json();
        return { success: false, error: err.message || 'Invalid credentials' };
      }
    } catch {
      return { success: false, error: 'Cannot connect to authentication server' };
    }
  };

  // Register handler contacting backend /api/auth/register
  const register = async (name, email, password) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        setRefreshToken(data.refresh_token);
        localStorage.setItem('rw_access_token', data.access_token);
        localStorage.setItem('rw_refresh_token', data.refresh_token);

        const userData = data.user || {
          id: data.user_id,
          email,
          name,
          role: 'member',
        };
        setUser(userData);
        return { success: true };
      } else {
        const err = await res.json();
        return { success: false, error: err.message || 'Registration failed' };
      }
    } catch {
      return { success: false, error: 'Cannot connect to server' };
    }
  };

  // Switch user directly (for testing and simulation)
  const switchUser = async (email, password) => {
    return await login(email, password);
  };

  // Sign out and clear stored session tokens
  const logout = async () => {
    try {
      if (refreshToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      localStorage.removeItem('rw_access_token');
      localStorage.removeItem('rw_refresh_token');
      localStorage.removeItem('rw_user');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, refreshToken, login, register, switchUser, logout, isAuthenticated: !!(user && isValidJwt(token)) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
