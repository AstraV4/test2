import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { getSocket, closeSocket } from '../lib/socket.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';
import { Avatar, Button } from '../components/ui/index.jsx';
import { Heart, MessageCircle } from 'lucide-react';
import { sound } from '../lib/sound.js';

const FriendsCtx = createContext(null);
export const useFriends = () => useContext(FriendsCtx);

const GAME_LABEL = { imposter: 'Imposteur', draw: 'Draw & Guess', party: 'Party' };
export function activityLabel(f) {
  if (!f.online) return { text: 'Hors ligne', color: 'text-muted', dot: 'bg-muted/50' };
  if (f.activity?.gameType) {
    const g = GAME_LABEL[f.activity.gameType] || 'une partie';
    return { text: f.activity.phase && f.activity.phase !== 'lobby' ? `Joue à ${g}` : `Dans un salon (${g})`, color: 'text-brand', dot: 'bg-brand', code: f.activity.code };
  }
  return { text: 'En ligne', color: 'text-success', dot: 'bg-success' };
}

export function FriendsProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [blocked, setBlocked] = useState([]);
  const [unread, setUnread] = useState({ counts: {}, total: 0 });
  const [invite, setInvite] = useState(null); // { code, gameType, fromName, fromAvatar }
  const [crushMatch, setCrushMatch] = useState(null); // { withId, withName, withAvatar }
  const [dmPing, setDmPing] = useState(0); // incrémenté à chaque DM reçu (pour rafraîchir les vues ouvertes)
  const userId = user?.id;

  const refresh = useCallback(async () => {
    if (!userId) { setData({ friends: [], incoming: [], outgoing: [] }); setBlocked([]); setUnread({ counts: {}, total: 0 }); return; }
    try { const d = await api('/api/friends'); setData(d); } catch { /* ignore */ }
    try { const b = await api('/api/mod/blocked'); setBlocked(b.blocked || []); } catch { /* ignore */ }
    try { const u = await api('/api/dm/unread'); setUnread(u); } catch { /* ignore */ }
  }, [userId]);

  const prevUserId = useRef(null);
  // Connexion socket + présence dès qu'on est connecté (reconnexion pour porter le cookie à jour)
  useEffect(() => {
    const prev = prevUserId.current;
    prevUserId.current = userId;
    if (!userId) {
      // Déconnexion réelle (on était connecté) -> on coupe la présence.
      if (prev) closeSocket();
      setData({ friends: [], incoming: [], outgoing: [] });
      return;
    }
    // (re)connexion authentifiée pour porter le cookie courant
    closeSocket();
    const socket = getSocket();
    refresh();
    const onPresence = (p) => setData(d => ({ ...d, friends: d.friends.map(f => f.id === p.userId ? { ...f, online: p.online, activity: p.activity } : f) }));
    const onUpdate = () => refresh();
    const onInvite = (inv) => { setInvite(inv); sound.play('notify'); };
    const onSent = () => toast.success('Invitation envoyée !');
    const onInviteErr = (e) => toast.error(e?.message || 'Invitation impossible.');
    const onDm = (m) => {
      setDmPing(p => p + 1);
      setUnread(u => ({ counts: { ...u.counts, [m.fromId]: (u.counts[m.fromId] || 0) + 1 }, total: (u.total || 0) + 1 }));
      if (!location.pathname.startsWith('/messages')) toast.info(`💬 ${m.fromName} : ${m.body.slice(0, 40)}`);
    };
    const onCrush = (c) => { setCrushMatch(c); sound.play('win'); };
    socket.on('friends:presence', onPresence);
    socket.on('friends:update', onUpdate);
    socket.on('invite:receive', onInvite);
    socket.on('invite:sent', onSent);
    socket.on('invite:error', onInviteErr);
    socket.on('dm:new', onDm);
    socket.on('crush:match', onCrush);
    socket.emit('game:sync'); // au cas où
    return () => { socket.off('friends:presence', onPresence); socket.off('friends:update', onUpdate); socket.off('invite:receive', onInvite); socket.off('invite:sent', onSent); socket.off('invite:error', onInviteErr); socket.off('dm:new', onDm); socket.off('crush:match', onCrush); };
  }, [userId, refresh, toast]);

  const addByUsername = async (username) => { const d = await api('/api/friends/request', { method: 'POST', body: { username } }); await refresh(); return d.status; };
  const accept = async (uid) => { await api('/api/friends/accept', { method: 'POST', body: { userId: uid } }); await refresh(); };
  const decline = async (uid) => { await api('/api/friends/decline', { method: 'POST', body: { userId: uid } }); await refresh(); };
  const cancel = async (uid) => { await api('/api/friends/cancel', { method: 'POST', body: { userId: uid } }); await refresh(); };
  const remove = async (uid) => { await api('/api/friends/remove', { method: 'POST', body: { userId: uid } }); await refresh(); };
  const invitePlayer = (uid) => { getSocket().emit('invite:send', { toUserId: uid }); };
  const block = async (uid) => { await api('/api/mod/block', { method: 'POST', body: { userId: uid } }); await refresh(); };
  const unblock = async (uid) => { await api('/api/mod/unblock', { method: 'POST', body: { userId: uid } }); await refresh(); };
  const report = async (uid, reason) => { await api('/api/mod/report', { method: 'POST', body: { userId: uid, reason } }); };
  const favorite = async (uid, on) => { await api('/api/friends/favorite', { method: 'POST', body: { userId: uid, on } }); await refresh(); };

  const blockedIds = new Set(blocked.map(b => b.id));
  const onlineCount = data.friends.filter(f => f.online).length;
  const markReadLocal = (otherId) => setUnread(u => { const c = { ...u.counts }; const n = c[otherId] || 0; delete c[otherId]; return { counts: c, total: Math.max(0, (u.total || 0) - n) }; });
  const value = { ...data, blocked, blockedIds, unread, dmPing, onlineCount, refresh, markReadLocal, addByUsername, accept, decline, cancel, remove, invitePlayer, block, unblock, report, favorite };

  return (
    <FriendsCtx.Provider value={value}>
      {children}
      {invite && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[85] w-[min(92vw,380px)] animate-slideUp">
          <div className="card rounded-2xl shadow-card p-4 gradient-border">
            <div className="flex items-center gap-3">
              <Avatar name={invite.fromAvatar} label={invite.fromName} size={40} ring />
              <div className="flex-1 min-w-0">
                <p className="text-sm"><b>{invite.fromName}</b> t'invite à jouer</p>
                <p className="text-xs text-muted">{GAME_LABEL[invite.gameType] || 'Partie'} · salon {invite.code}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="flex-1" onClick={() => { const c = invite.code; setInvite(null); try { sessionStorage.setItem('pr_identity', JSON.stringify({ name: user?.username || 'Joueur', avatar: user?.avatar || 'nebula' })); } catch { /* ignore */ } nav(`/salon/${c}`); }}>Rejoindre</Button>
              <Button size="sm" variant="ghost" onClick={() => setInvite(null)}>Ignorer</Button>
            </div>
          </div>
        </div>
      )}
      {crushMatch && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-popIn" onClick={() => setCrushMatch(null)} />
          <div className="relative z-10 w-full max-w-sm card rounded-3xl p-8 text-center animate-slideUp gradient-border" style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.16), rgba(124,92,255,0.10))' }}>
            <div className="text-6xl mb-2 animate-floaty">💞</div>
            <h2 className="font-display font-bold text-2xl mb-1">C'est réciproque !</h2>
            <div className="flex items-center justify-center gap-3 my-4">
              <Avatar name={user?.avatar} label={user?.username} size={48} ring />
              <Heart className="h-6 w-6 text-rose-400 fill-rose-400" />
              <Avatar name={crushMatch.withAvatar} label={crushMatch.withName} size={48} ring />
            </div>
            <p className="text-sm text-muted mb-6">Toi et <b className="text-text">{crushMatch.withName}</b>, vous avez craqué l'un pour l'autre. 💛</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => { const w = crushMatch.withId; setCrushMatch(null); nav(`/messages/${w}`); }}><MessageCircle className="h-4 w-4" /> Lui écrire</Button>
              <Button variant="ghost" onClick={() => setCrushMatch(null)}>Plus tard</Button>
            </div>
          </div>
        </div>
      )}
    </FriendsCtx.Provider>
  );
}
