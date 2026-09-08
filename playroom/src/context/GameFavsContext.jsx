import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const GameFavsCtx = createContext(null);
export const useGameFavs = () => useContext(GameFavsCtx) || { favs: new Set(), toggle: () => {}, has: () => false };

export function GameFavsProvider({ children }) {
  const { user } = useAuth();
  const [favs, setFavs] = useState(new Set());

  useEffect(() => {
    if (!user) { setFavs(new Set()); return; }
    api('/api/me/games/favorites').then(d => setFavs(new Set(d.favorites || []))).catch(() => {});
  }, [user?.id]);

  const toggle = useCallback(async (gameId) => {
    if (!user) return false;
    const on = !favs.has(gameId);
    setFavs(prev => { const n = new Set(prev); on ? n.add(gameId) : n.delete(gameId); return n; }); // optimiste
    try { const d = await api('/api/me/games/favorite', { method: 'POST', body: { gameId, on } }); setFavs(new Set(d.favorites || [])); } catch { /* ignore */ }
    return on;
  }, [user, favs]);

  const has = useCallback((id) => favs.has(id), [favs]);
  return <GameFavsCtx.Provider value={{ favs, toggle, has, loggedIn: !!user }}>{children}</GameFavsCtx.Provider>;
}
