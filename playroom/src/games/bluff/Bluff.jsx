import React, { useEffect, useState } from 'react';
import { Feather, Check, Trophy, Send } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { useCountdown } from '../../lib/hooks.js';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

// Bluff : invente une fausse réponse, puis retrouve la vraie parmi les intrus.
export default function Bluff({ socket, room, playerId, endsAt }) {
  const [text, setText] = useState('');
  const [myAnswer, setMyAnswer] = useState('');
  const [picked, setPicked] = useState(null);
  const [over, setOver] = useState(null);
  const left = useCountdown(endsAt);
  const me = room.players.find(p => p.id === playerId);
  const isHost = me?.isHost;
  const b = room.bluff;
  const phase = room.phase;

  useEffect(() => { setText(''); setMyAnswer(''); setPicked(null); }, [b?.turn]);
  useEffect(() => {
    const onOver = (d) => { setOver(d); burstConfetti(); sound.play('win'); };
    const onReveal = () => sound.play('ok');
    socket.on('bluff:over', onOver); socket.on('bluff:reveal', onReveal);
    return () => { socket.off('bluff:over', onOver); socket.off('bluff:reveal', onReveal); };
  }, [socket]);

  if (phase === 'bluffOver' || over) return <Podium podium={over?.podium || room.genericPodium} socket={socket} isHost={isHost} title="Fin du Bluff !" />;
  if (!b) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;

  const submitAnswer = () => { const t = text.trim(); if (!t) return; setMyAnswer(t); socket.emit('bluff:answer', { text: t }); sound.play('click'); };
  const pick = (i) => { setPicked(i); socket.emit('bluff:pick', { index: i }); sound.play('click'); };
  const answeredCount = b.answeredIds?.length || 0;
  const totalPlayers = room.players.filter(p => p.connected).length;
  const iAnswered = b.answeredIds?.includes(playerId) || myAnswer;
  const revealed = phase === 'bluffReveal' && b.reveal;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tag color="brand"><Feather className="h-3 w-3" /> Bluff</Tag>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">Manche {b.turn}/{b.total}</span>
          {!revealed && left > 0 && <span className={`font-mono font-bold ${left <= 5 ? 'text-danger' : 'text-muted'}`}>{left}s</span>}
        </div>
      </div>

      <div className="card rounded-2xl p-6 text-center">
        <p className="text-xs text-muted mb-1">{phase === 'bluffWrite' ? 'Invente une réponse crédible…' : phase === 'bluffGuess' ? 'Retrouve LA vraie réponse' : 'Résultat'}</p>
        <h3 className="font-display font-bold text-lg md:text-xl">{b.question}</h3>
      </div>

      {/* Phase écriture */}
      {phase === 'bluffWrite' && (
        iAnswered ? (
          <p className="text-center text-sm text-muted">Réponse envoyée ✓ · {answeredCount}/{totalPlayers} ont répondu</p>
        ) : (
          <div className="flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitAnswer()} maxLength={60} autoFocus
              placeholder="Ta fausse réponse…" className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />
            <Button onClick={submitAnswer}><Send className="h-4 w-4" /></Button>
          </div>
        )
      )}

      {/* Phase devinette */}
      {phase === 'bluffGuess' && b.options && (
        <div className="grid gap-2">
          {b.options.map(o => {
            const mine = o.text.trim().toLowerCase() === myAnswer.trim().toLowerCase() && myAnswer;
            return (
              <button key={o.i} disabled={picked !== null || mine} onClick={() => pick(o.i)}
                className={`text-left rounded-xl border px-4 py-3 text-sm transition-all ${picked === o.i ? 'border-brand bg-brand/10' : 'border-border bg-surface-2 hover:border-brand/50'} ${mine ? 'opacity-40 cursor-not-allowed' : ''}`}>
                {o.text} {mine && <span className="text-xs text-muted">(ta réponse)</span>}
              </button>
            );
          })}
          {picked !== null && <p className="text-center text-xs text-muted">Choix enregistré…</p>}
        </div>
      )}

      {/* Révélation */}
      {revealed && (
        <div className="space-y-2">
          {b.reveal.options.map((o, i) => (
            <div key={i} className={`rounded-xl border px-4 py-3 ${o.real ? 'border-success bg-success/10' : 'border-border'}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{o.text} {o.real && <Tag color="success" className="ml-1">Vraie réponse</Tag>}</span>
                <span className="text-xs text-muted">{o.voters.length} vote{o.voters.length > 1 ? 's' : ''}</span>
              </div>
              <div className="text-xs text-muted mt-1">
                {!o.real && o.owners.length > 0 && <>Bluff de {o.owners.join(', ')} · </>}
                {o.voters.length > 0 ? `Choisi par ${o.voters.join(', ')}` : 'Personne'}
              </div>
            </div>
          ))}
          {b.reveal.truthFinders.length > 0 && <p className="text-xs text-success text-center">{b.reveal.truthFinders.join(', ')} avai(en)t écrit la vérité ! 🎯</p>}
          {isHost && <div className="text-center pt-2"><Button onClick={() => socket.emit('game:next')}>{b.turn >= b.total ? 'Classement' : 'Manche suivante'} →</Button></div>}
        </div>
      )}

      {/* Scores */}
      <ScoreChips players={room.players} />
    </div>
  );
}

function ScoreChips({ players }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {[...players].sort((a, b) => (b.score || 0) - (a.score || 0)).map(p => (
        <div key={p.id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-surface-2 text-muted">
          <span className="font-medium">{p.name}</span> <b className="text-text">{p.score || 0}</b>
        </div>
      ))}
    </div>
  );
}

export function Podium({ podium = [], socket, isHost, title }) {
  return (
    <div className="space-y-4">
      <div className="text-center"><Trophy className="h-10 w-10 mx-auto text-warning mb-2" /><h3 className="font-display font-bold text-2xl">{title}</h3></div>
      <div className="grid grid-cols-3 gap-3 items-end max-w-md mx-auto">
        {[1, 0, 2].map(pos => {
          const r = podium[pos]; if (!r) return <div key={pos} />;
          const h = ['h-20', 'h-28', 'h-16']; const medal = ['🥈', '🥇', '🥉']; const ord = pos === 0 ? 1 : pos === 1 ? 0 : 2;
          return (
            <div key={pos} className="flex flex-col items-center">
              <Avatar name={r.avatar} label={r.name} size={pos === 1 ? 52 : 42} ring={pos === 1} />
              <div className="text-sm font-semibold mt-1 truncate max-w-full">{r.name}</div>
              <div className="text-xs text-muted">{r.score} pts</div>
              <div className={`mt-2 w-full ${h[ord]} rounded-t-xl bg-gradient-to-t from-surface-2 to-brand/20 flex items-start justify-center pt-2 text-2xl`}>{medal[ord]}</div>
            </div>
          );
        })}
      </div>
      {isHost && <Button className="w-full" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button>}
    </div>
  );
}
