import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, MessageCircle, Lock } from 'lucide-react';
import { Avatar } from './ui/index.jsx';
import { useFriends } from '../context/FriendsContext.jsx';

// Chat de salon réutilisable (Imposteur + Draw & Guess).
// Le serveur valide et limite les messages ; ici on affiche et on émet.
// En Draw & Guess, une bonne réponse est interceptée côté serveur (jamais diffusée),
// et un message système "a trouvé le mot" arrive via 'draw:correct'.
export default function Chat({ socket, room, playerId, compact = false }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const friends = useFriends();
  const blockedIds = friends?.blockedIds || new Set();
  const nav = useNavigate();

  useEffect(() => {
    const onMsg = (m) => setMessages(prev => [...prev.slice(-80), { ...m, kind: 'msg' }]);
    const onCorrect = (d) => setMessages(prev => [...prev.slice(-80), { kind: 'correct', name: d.name, order: d.order, ts: Date.now(), id: Math.random() }]);
    const onReveal = (d) => setMessages(prev => [...prev.slice(-80), { kind: 'system', text: `Le mot était « ${d.word} »`, ts: Date.now(), id: Math.random() }]);
    socket.on('chat:msg', onMsg);
    socket.on('draw:correct', onCorrect);
    socket.on('draw:reveal', onReveal);
    return () => { socket.off('chat:msg', onMsg); socket.off('draw:correct', onCorrect); socket.off('draw:reveal', onReveal); };
  }, [socket]);

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);

  const allowed = room.chatAllowed !== false;
  const isDrawer = room.gameType === 'draw' && room.players.find(p => p.id === playerId)?.isDrawer;
  const placeholder = room.gameType === 'draw'
    ? (isDrawer ? 'Tu dessines — pas de triche 🤫' : 'Écris ta réponse ou discute…')
    : (allowed ? 'Écris un message…' : 'Chat désactivé pendant cette phase');

  const send = () => {
    const t = text.trim(); if (!t) return;
    socket.emit('chat:send', { text: t }); setText('');
  };

  return (
    <div className={`card rounded-2xl flex flex-col ${compact ? 'h-64' : 'h-80 lg:h-[540px]'}`}>
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 text-sm font-semibold">
        <MessageCircle className="h-4 w-4 text-brand" /> Chat
        {!allowed && <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted"><Lock className="h-3 w-3" /> désactivé</span>}
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.length === 0 && <p className="text-xs text-muted text-center py-6">Pas encore de message.</p>}
        {messages.map((m, i) => {
          if (m.kind === 'msg' && m.playerId && blockedIds.has(m.playerId)) return null;
          if (m.kind === 'correct') return <div key={m.id || i} className="text-xs text-success font-semibold px-1">✅ {m.name} a trouvé le mot ! {m.order === 1 && '🥇'}</div>;
          if (m.kind === 'system') return <div key={m.id || i} className="text-xs text-muted italic px-1">{m.text}</div>;
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              {m.userId ? (
                <button onClick={() => nav(`/u/${m.userId}`)} className="flex-none"><Avatar name={m.avatar} label={m.name} size={22} /></button>
              ) : <Avatar name={m.avatar} label={m.name} size={22} />}
              <div className="min-w-0">
                {m.userId ? <button onClick={() => nav(`/u/${m.userId}`)} className="font-semibold text-xs hover:text-brand transition-colors">{m.name}</button> : <span className="font-semibold text-xs">{m.name}</span>}
                {' '}<span className="text-text break-words">{m.text}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-2 border-t border-border flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} maxLength={140}
          disabled={!allowed} placeholder={placeholder}
          className="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand disabled:opacity-50" />
        <button onClick={send} disabled={!allowed} className="rounded-xl bg-brand text-white px-3 disabled:opacity-40"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
