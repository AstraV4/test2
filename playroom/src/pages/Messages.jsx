import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Send, MessageCircle, ArrowLeft, Lock, Users2, Gamepad2, Trash2, Check, CheckCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFriends, activityLabel } from '../context/FriendsContext.jsx';
import { Card, Button, Avatar, EmptyState, Spinner } from '../components/ui/index.jsx';

// "il y a X" court
function ago(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'à l\u2019instant';
  const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24); if (d < 7) return `il y a ${d} j`;
  return new Date(ts).toLocaleDateString('fr-FR');
}

export default function Messages() {
  const { userId } = useParams();
  const { user, openAuth } = useAuth();
  const friends = useFriends();
  const nav = useNavigate();

  if (!user) return (
    <div className="py-16"><EmptyState icon={Lock} title="Connecte-toi pour discuter" hint="Envoie des messages à tes amis, même en dehors des parties." action={<Button onClick={() => openAuth('login')}>Se connecter</Button>} /></div>
  );

  const active = userId ? friends.friends.find(f => String(f.id) === String(userId)) : null;

  return (
    <div className="py-8">
      <h1 className="font-display font-bold text-3xl md:text-4xl inline-flex items-center gap-2 mb-6"><MessageCircle className="h-7 w-7 text-brand" /> Messages</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <Card className={`p-2 md:col-span-1 ${active ? 'hidden md:block' : ''}`}>
          {friends.friends.length === 0 ? (
            <div className="p-4"><EmptyState icon={Users2} title="Aucun ami" hint="Ajoute des amis pour discuter." action={<Button as={Link} to="/amis" size="sm">Trouver des amis</Button>} /></div>
          ) : (
            <div className="space-y-1">
              {friends.friends.map(f => {
                const st = activityLabel(f);
                const unread = friends.unread?.counts?.[f.id] || 0;
                return (
                  <button key={f.id} onClick={() => nav(`/messages/${f.id}`)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${String(f.id) === String(userId) ? 'bg-brand/10' : 'hover:bg-surface-2'}`}>
                    <div className="relative"><Avatar name={f.avatar} label={f.username} size={38} /><span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${st.dot}`} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{friends.nameOf(f)}</div>
                      <div className={`text-xs ${st.color} truncate`}>{f.online ? st.text : (f.lastSeen ? `vu ${ago(f.lastSeen)}` : 'hors ligne')}</div>
                    </div>
                    {unread > 0 && <span className="h-5 min-w-5 px-1.5 rounded-full bg-danger text-white text-xs font-bold flex items-center justify-center">{unread}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <div className={`md:col-span-2 ${!active ? 'hidden md:block' : ''}`}>
          {active ? <Thread key={active.id} friend={active} me={user} /> : (
            <Card className="p-12 h-full flex items-center justify-center"><EmptyState icon={MessageCircle} title="Choisis une conversation" hint="Sélectionne un ami à gauche pour commencer à discuter." /></Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Thread({ friend, me }) {
  const friends = useFriends();
  const nav = useNavigate();
  const [messages, setMessages] = useState(null);
  const [lastRead, setLastRead] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const listRef = useRef(null);
  const st = activityLabel(friend);
  const name = friends.nameOf(friend);

  const load = async () => {
    try { const d = await api(`/api/dm/${friend.id}`); setMessages(d.messages); setLastRead(d.lastRead); friends.markReadLocal(friend.id); }
    catch { setMessages([]); }
  };
  useEffect(() => { setMessages(null); load(); }, [friend.id]);
  useEffect(() => { if (messages !== null) load(); /* eslint-disable-next-line */ }, [friends.dmPing]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);

  // Accusé de lecture temps réel + suppression temps réel
  useEffect(() => {
    const socket = getSocket();
    const onRead = (d) => { if (d.by === friend.id) setLastRead(d.at); };
    const onDeleted = (d) => setMessages(m => (m || []).map(x => x.id === d.messageId ? { ...x, deleted: 1, body: '' } : x));
    socket.on('dm:read', onRead); socket.on('dm:deleted', onDeleted);
    return () => { socket.off('dm:read', onRead); socket.off('dm:deleted', onDeleted); };
  }, [friend.id]);

  const send = async () => {
    const body = text.trim(); if (!body || sending) return;
    setSending(true); setText('');
    setMessages(m => [...(m || []), { id: 'tmp' + Math.random(), fromId: me.id, toId: friend.id, body, createdAt: Date.now() }]);
    try { const d = await api(`/api/dm/${friend.id}`, { method: 'POST', body: { body } }); if (d.message) setMessages(m => m.map(x => (typeof x.id === 'string' && x.id.startsWith('tmp') && x.body === body) ? { ...x, id: d.message.id } : x)); } catch { /* ignore */ } finally { setSending(false); }
  };
  const del = async (id) => {
    setMenuId(null);
    setMessages(m => m.map(x => x.id === id ? { ...x, deleted: 1, body: '' } : x));
    try { await api(`/api/dm/${friend.id}/delete`, { method: 'POST', body: { messageId: id } }); } catch { /* ignore */ }
  };

  // dernier message envoyé par moi (pour l'indicateur Vu/Envoyé)
  const myMsgs = (messages || []).filter(m => m.fromId === me.id && !m.deleted);
  const lastMine = myMsgs[myMsgs.length - 1];

  return (
    <Card className="flex flex-col h-[70vh]">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <button onClick={() => nav('/messages')} className="md:hidden text-muted hover:text-text"><ArrowLeft className="h-5 w-5" /></button>
        <button onClick={() => nav(`/u/${friend.id}`)} className="relative"><Avatar name={friend.avatar} label={friend.username} size={38} /><span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${st.dot}`} /></button>
        <button onClick={() => nav(`/u/${friend.id}`)} className="flex-1 min-w-0 text-left"><div className="font-semibold truncate hover:text-brand transition-colors">{name}</div><div className={`text-xs ${st.color}`}>{friend.online ? st.text : (friend.lastSeen ? `vu ${ago(friend.lastSeen)}` : 'hors ligne')}</div></button>
        {st.code && <Button size="sm" variant="outline" onClick={() => { try { sessionStorage.setItem('pr_identity', JSON.stringify({ name: me.username, avatar: me.avatar })); } catch { /* ignore */ } nav(`/salon/${st.code}`); }}><Gamepad2 className="h-4 w-4" /> Rejoindre</Button>}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-1.5">
        {messages === null ? <Spinner className="mx-auto my-10" /> : messages.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">Aucun message. Dis bonjour 👋</p>
        ) : messages.map((m) => {
          const mine = m.fromId === me.id;
          if (m.deleted) return <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className="max-w-[75%] rounded-2xl px-4 py-2 text-sm italic text-muted bg-surface-2/50 border border-border">🚫 message supprimé</div></div>;
          return (
            <div key={m.id} className={`group flex items-center gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
              {mine && typeof m.id === 'number' && (
                <div className="relative">
                  <button onClick={() => setMenuId(menuId === m.id ? null : m.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition-opacity p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                  {menuId === m.id && <button onClick={() => del(m.id)} className="absolute right-0 top-6 z-10 whitespace-nowrap rounded-lg bg-surface border border-border px-3 py-1.5 text-xs text-danger shadow-card">Supprimer</button>}
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? 'bg-brand text-white rounded-br-sm' : 'bg-surface-2 text-text rounded-bl-sm'}`}>{m.body}</div>
            </div>
          );
        })}
        {/* Indicateur Vu / Envoyé sous le dernier message envoyé */}
        {lastMine && (
          <div className="flex justify-end pr-1">
            <span className="text-[11px] text-muted inline-flex items-center gap-1">
              {lastRead && lastRead >= lastMine.createdAt ? <><CheckCheck className="h-3 w-3 text-brand" /> Vu</> : <><Check className="h-3 w-3" /> Envoyé</>}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} maxLength={1000}
          placeholder={`Message à ${name}…`} className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-brand" />
        <Button onClick={send} disabled={sending}><Send className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}
