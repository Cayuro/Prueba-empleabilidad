import React, { createContext, useContext, useState, useEffect } from 'react';

// Create Theme Context for global theme state
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Read persisted theme or default to dark mode per specification
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('rw_theme') || 'dark';
  });

  // Keep html class and localStorage in sync with theme state
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('rw_theme', theme);
  }, [theme]);

  // Toggle between dark and light mode
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook for accessing theme context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
