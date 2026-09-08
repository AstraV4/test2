import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  useEffect(() => {
    api('/api/auth/me').then(d => setUser(d.user)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const d = await api('/api/auth/login', { method: 'POST', body: { username, password } });
    setUser(d.user); return d.user;
  };
  const register = async (payload) => {
    const d = await api('/api/auth/register', { method: 'POST', body: payload });
    setUser(d.user); return d.user;
  };
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); };
  const refresh = useCallback(async () => { try { const d = await api('/api/auth/me'); setUser(d.user); } catch { /* ignore */ } }, []);
  const setAvatar = async (avatar) => { const d = await api('/api/me/avatar', { method: 'POST', body: { avatar } }); setUser(d.user); };
  const updateProfile = async (patch) => { const d = await api('/api/me/profile-update', { method: 'POST', body: patch }); setUser(d.user); return d.user; };

  const openAuth = (mode = 'login') => { setAuthMode(mode); setAuthOpen(true); };
  const closeAuth = () => setAuthOpen(false);

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, register, logout, refresh, setAvatar, updateProfile, authOpen, authMode, openAuth, closeAuth }}>
      {children}
    </AuthCtx.Provider>
  );
}
