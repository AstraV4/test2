import React, { useEffect, useRef, useState } from 'react';
import { Zap, Send, Heart } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { useCountdown } from '../../lib/hooks.js';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

export default function Assoc({ socket, room, playerId, endsAt }) {
  const [word, setWord] = useState('');
  const [answered, setAnswered] = useState(false);
  const [over, setOver] = useState(null);
  const A = room.assoc;
  const me = room.players.find(p => p.id === playerId);
  const opp = room.players.find(p => p.id !== playerId);
  const isHost = me?.isHost;
  const left = useCountdown(endsAt);
  const prev = useRef(0);

  useEffect(() => {
    const onReveal = (r) => { sound.play(r.match ? 'win' : 'tick'); if (r.match) burstConfetti(16); };
    const onOver = (o) => { setOver(o); burstConfetti(); sound.play('win'); };
    const onLobby = () => setOver(null);
    socket.on('assoc:reveal', onReveal); socket.on('assoc:over', onOver); socket.on('game:toLobby', onLobby);
    return () => { socket.off('assoc:reveal', onReveal); socket.off('assoc:over', onOver); socket.off('game:toLobby', onLobby); };
  }, [socket]);
  useEffect(() => { if (A && A.round !== prev.current) { prev.current = A.round; setWord(''); setAnswered(false); } }, [A?.round]);

  if (!A) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;
  const phase = room.phase;

  if (phase === 'assOver' || over) {
    const res = over || room.assResult;
    const msg = res.affinity >= 70 ? 'Vous êtes sur la même longueur d\u2019onde ! 💞' : res.affinity >= 40 ? 'Belle complicité !' : 'Deux esprits différents 😄';
    return (
      <div className="py-4 space-y-4 text-center">
        <div className="relative inline-block"><Heart className="h-16 w-16 text-rose-400 fill-rose-400/20" /><span className="absolute inset-0 flex items-center justify-center font-display font-bold">{res.affinity}%</span></div>
        <h3 className="font-display font-bold text-2xl">Même mot : {res.matches}/{res.total}</h3>
        <p className="font-semibold">{msg}</p>
        {res.chain?.length > 0 && (
          <div className="card rounded-2xl p-4 text-left max-w-md mx-auto">
            <p className="text-xs text-muted mb-2">Votre chaîne :</p>
            <div className="flex flex-wrap gap-1.5">{res.chain.map((c, i) => <Tag key={i} color={c.match ? 'success' : 'muted'}>{c.word || '—'}</Tag>)}</div>
          </div>
        )}
        {isHost && <div className="flex gap-2 justify-center"><Button onClick={() => socket.emit('game:next')}>Rejouer</Button><Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button></div>}
      </div>
    );
  }

  const reveal = phase === 'assReveal' && A.reveal;
  const send = () => { const w = word.trim(); if (!w || answered) return; setAnswered(true); socket.emit('assoc:answer', { word: w }); sound.play('click'); };

  return (
    <div className="space-y-4 text-center">
      <div className="flex items-center justify-between"><Tag color="brand"><Zap className="h-3 w-3" /> Association</Tag><span className="text-sm text-muted">Mot {A.round}/8</span></div>
      <p className="text-sm text-muted">Le premier mot qui te vient en pensant à…</p>
      <div className="card rounded-2xl py-8"><div className="text-4xl font-display font-bold gradient-text">{A.current}</div></div>

      {reveal ? (
        <div className="animate-popIn">
          <div className="flex items-center justify-center gap-8 py-2">
            <div><div className="text-2xl font-display font-bold">{A.reveal.a || '—'}</div><div className="text-xs text-muted mt-1">{me?.name}</div></div>
            <span className="text-xl text-muted">/</span>
            <div><div className="text-2xl font-display font-bold">{A.reveal.b || '—'}</div><div className="text-xs text-muted mt-1">{opp?.name}</div></div>
          </div>
          <p className="font-semibold mt-1">{A.reveal.match ? '💞 Même mot !' : '↔️ Mots différents'}</p>
        </div>
      ) : answered ? (
        <p className="py-4 text-muted">En attente de {opp?.name}… ⏳ {left}s</p>
      ) : (
        <div className="flex gap-2 max-w-sm mx-auto">
          <input value={word} onChange={e => setWord(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} autoFocus maxLength={24} placeholder="Vite, un mot !"
            className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-center outline-none focus:border-brand" />
          <Button onClick={send}><Send className="h-4 w-4" /></Button>
        </div>
      )}
      {!reveal && !answered && <p className="text-xs text-muted">⏱️ {left}s — écris vite, sans réfléchir !</p>}
    </div>
  );
}
