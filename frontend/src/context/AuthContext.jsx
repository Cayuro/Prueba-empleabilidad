import React, { createContext, useContext, useState, useEffect } from 'react';

// Demo users from seed data for instant testing and local simulation
export const DEMO_USERS = [
  {
    id: "c0000000-0000-0000-0000-000000000001",
    email: "admin@riwi.io",
    name: "Carlos Mendoza",
    role: "admin",
  },
  {
    id: "c0000000-0000-0000-0000-000000000002",
    email: "valeria.dev@riwi.io",
    name: "Valeria Gomez",
    role: "member",
  },
  {
    id: "c0000000-0000-0000-0000-000000000003",
    email: "santiago.coder@riwi.io",
    name: "Santiago Restrepo",
    role: "member",
  },
  {
    id: "c0000000-0000-0000-0000-000000000004",
    email: "mariana.ai@riwi.io",
    name: "Mariana Torres",
    role: "member",
  },
  {
    id: "c0000000-0000-0000-0000-000000000005",
    email: "alejandro.lead@riwi.io",
    name: "Alejandro Castro",
    role: "admin",
  }
];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Current logged in user object
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rw_user');
    return saved ? JSON.parse(saved) : DEMO_USERS[0];
  });

  // JWT Access token for backend REST requests
  const [token, setToken] = useState(() => localStorage.getItem('rw_access_token') || 'demo_token');
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('rw_refresh_token') || 'demo_refresh');

  // Sync auth state to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('rw_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('rw_user');
    }
  }, [user]);

  // Login handler contacting backend /api/auth/login with mock fallback
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

        // Find demo user match or construct user
        const matched = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase()) || {
          id: data.user_id || 'c0000000-0000-0000-0000-000000000001',
          email,
          name: email.split('@')[0],
          role: 'member',
        };
        setUser(matched);
        return { success: true };
      }
    } catch {
      // Backend not running, check demo users list
      const matched = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        setUser(matched);
        setToken('demo_token_' + matched.id);
        return { success: true };
      }
    }

    // Direct fallback for testing
    const demo = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (demo) {
      setUser(demo);
      setToken('demo_token_' + demo.id);
      return { success: true };
    }

    return { success: false, error: 'Invalid credentials' };
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

  // Switch demo user quickly for RLS testing
  const switchUser = (selectedUser) => {
    setUser(selectedUser);
    setToken('demo_token_' + selectedUser.id);
    localStorage.setItem('rw_user', JSON.stringify(selectedUser));
    localStorage.setItem('rw_access_token', 'demo_token_' + selectedUser.id);
  };

  return (
    <AuthContext.Provider value={{ user, token, refreshToken, login, logout, switchUser, isAuthenticated: !!user }}>
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
