import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi } from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('hivoid_token'));
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!token;

  // Verify token on mount
  useEffect(() => {
    if (token) {
      authApi
        .me()
        .then((data) => {
          setAdmin(data);
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('hivoid_token');
          setToken(null);
          setAdmin(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password);
    localStorage.setItem('hivoid_token', data.access_token);
    setToken(data.access_token);
    const me = await authApi.me();
    setAdmin(me);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hivoid_token');
    setToken(null);
    setAdmin(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, admin, isAuthenticated, loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
