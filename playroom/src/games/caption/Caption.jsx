import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, Trophy, Crown } from 'lucide-react';
import { Tag, Button, Spinner } from '../../components/ui/index.jsx';
import { useCountdown } from '../../lib/hooks.js';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { Podium } from '../bluff/Bluff.jsx';
import { sound } from '../../lib/sound.js';

// Caption Battle : une situation, chacun écrit sa réponse la plus drôle, puis on vote.
export default function Caption({ socket, room, playerId, endsAt }) {
  const [text, setText] = useState('');
  const [answered, setAnswered] = useState(false);
  const [voted, setVoted] = useState(null);
  const [over, setOver] = useState(null);
  const left = useCountdown(endsAt);
  const me = room.players.find(p => p.id === playerId);
  const isHost = me?.isHost;
  const c = room.caption;
  const phase = room.phase;

  useEffect(() => { setText(''); setAnswered(false); setVoted(null); }, [c?.turn]);
  useEffect(() => {
    const onOver = (d) => { setOver(d); burstConfetti(); sound.play('win'); };
    const onReveal = () => sound.play('ok');
    socket.on('caption:over', onOver); socket.on('caption:reveal', onReveal);
    return () => { socket.off('caption:over', onOver); socket.off('caption:reveal', onReveal); };
  }, [socket]);

  if (phase === 'capOver' || over) return <Podium podium={over?.podium || room.genericPodium} socket={socket} isHost={isHost} title="Fin du Caption Battle !" />;
  if (!c) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;

  const send = () => { const t = text.trim(); if (!t) return; setAnswered(true); socket.emit('caption:answer', { text: t }); sound.play('click'); };
  const vote = (id) => { setVoted(id); socket.emit('caption:vote', { targetId: id }); sound.play('click'); };
  const totalPlayers = room.players.filter(p => p.connected).length;
  const revealed = phase === 'capReveal' && c.reveal;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tag color="brand"><MessageSquare className="h-3 w-3" /> Caption Battle</Tag>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">Manche {c.turn}/{c.total}</span>
          {!revealed && left > 0 && <span className={`font-mono font-bold ${left <= 5 ? 'text-danger' : 'text-muted'}`}>{left}s</span>}
        </div>
      </div>

      <div className="card rounded-2xl p-6 text-center">
        <p className="text-xs text-muted mb-1">{phase === 'capWrite' ? 'Écris ta réponse la plus drôle' : phase === 'capVote' ? 'Vote pour la meilleure' : 'Résultats'}</p>
        <h3 className="font-display font-bold text-lg md:text-xl">{c.prompt}</h3>
      </div>

      {/* Écriture */}
      {phase === 'capWrite' && (
        answered ? (
          <p className="text-center text-sm text-muted">Réponse envoyée ✓ · {c.answeredIds.length}/{totalPlayers} ont répondu</p>
        ) : (
          <div className="flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} maxLength={100} autoFocus
              placeholder="Ta réponse…" className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />
            <Button onClick={send}><Send className="h-4 w-4" /></Button>
          </div>
        )
      )}

      {/* Vote */}
      {phase === 'capVote' && c.entries && (
        <div className="grid gap-2">
          {c.entries.map(e => {
            const mine = e.id === playerId;
            return (
              <button key={e.id} disabled={voted !== null || mine} onClick={() => vote(e.id)}
                className={`text-left rounded-xl border px-4 py-3 text-sm transition-all ${voted === e.id ? 'border-brand bg-brand/10' : 'border-border bg-surface-2 hover:border-brand/50'} ${mine ? 'opacity-40 cursor-not-allowed' : ''}`}>
                “{e.text}” {mine && <span className="text-xs text-muted">(ta réponse)</span>}
              </button>
            );
          })}
          {voted !== null && <p className="text-center text-xs text-muted">Vote enregistré…</p>}
        </div>
      )}

      {/* Révélation */}
      {revealed && (
        <div className="space-y-2">
          {c.reveal.entries.map((e, i) => (
            <div key={i} className={`rounded-xl border px-4 py-3 ${i === 0 && e.votes > 0 ? 'border-warning bg-warning/10' : 'border-border'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm">“{e.text}”</span>
                <span className="text-xs font-bold text-muted whitespace-nowrap ml-2">{i === 0 && e.votes > 0 && <Crown className="h-3.5 w-3.5 inline text-warning mr-1" />}{e.votes} vote{e.votes > 1 ? 's' : ''}</span>
              </div>
              <div className="text-xs text-muted mt-1">— {e.author}</div>
            </div>
          ))}
          {isHost && <div className="text-center pt-2"><Button onClick={() => socket.emit('game:next')}>{c.turn >= c.total ? 'Classement' : 'Manche suivante'} →</Button></div>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        {[...room.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map(p => (
          <div key={p.id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-surface-2 text-muted">
            <span className="font-medium">{p.name}</span> <b className="text-text">{p.score || 0}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
