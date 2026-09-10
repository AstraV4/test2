import React, { useEffect, useState } from 'react';
import { Gauge, Send, Trophy, Check } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

// Devine la note : le site a noté un sujet /10 (secret, montré au donneur d'indices).
// Le donneur fait deviner la note avec des mots (sans chiffres), l'autre devine le nombre.
export default function GuessNote({ socket, room, playerId }) {
  const [secret, setSecret] = useState(null); // { note, subject } — seulement pour le donneur
  const [clue, setClue] = useState('');
  const [guess, setGuess] = useState(null);
  const [over, setOver] = useState(null);
  const G = room.gn;
  const me = room.players.find(p => p.id === playerId);
  const opp = room.players.find(p => p.id !== playerId);
  const isHost = me?.isHost;

  useEffect(() => {
    const onSecret = (d) => setSecret(d);
    const onReveal = (r) => sound.play(r.pts >= 2 ? 'win' : r.pts === 1 ? 'ok' : 'error');
    const onOver = (o) => { setOver(o); if (o.winnerId === playerId) { burstConfetti(); sound.play('win'); } else sound.play(o.winnerId === 'draw' ? 'ok' : 'lose'); };
    const onLobby = () => { setOver(null); setSecret(null); };
    socket.on('gn:secret', onSecret); socket.on('gn:reveal', onReveal); socket.on('gn:over', onOver); socket.on('game:toLobby', onLobby);
    return () => { socket.off('gn:secret', onSecret); socket.off('gn:reveal', onReveal); socket.off('gn:over', onOver); socket.off('game:toLobby', onLobby); };
  }, [socket, playerId]);
  useEffect(() => { setClue(''); setGuess(null); if (G && room.phase !== 'gnHint') { /* keep secret */ } if (G?.round) setSecret(s => (s && G.hinterId === playerId) ? s : (G.hinterId === playerId ? s : null)); }, [G?.round]);

  if (!G) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;
  const phase = room.phase;
  const iAmHinter = G.hinterId === playerId;

  if (phase === 'gnOver' || over) {
    const res = over || room.gnResult; const iWon = res.winnerId === playerId;
    return (
      <div className="text-center py-6 space-y-4">
        <Trophy className={`h-12 w-12 mx-auto ${res.winnerId === 'draw' ? 'text-muted' : iWon ? 'text-warning' : 'text-muted'}`} />
        <h3 className="font-display font-bold text-2xl">{res.winnerId === 'draw' ? 'Égalité !' : iWon ? 'Bien joué ! 🎉' : `${opp?.name} gagne`}</h3>
        <div className="flex items-center justify-center gap-6"><Sc name={me?.name} avatar={me?.avatar} v={res.scores[playerId]} me /><span className="text-xl text-muted">—</span><Sc name={opp?.name} avatar={opp?.avatar} v={res.scores[opp?.id]} /></div>
        {isHost && <div className="flex gap-2 justify-center"><Button onClick={() => socket.emit('game:next')}>Rejouer</Button><Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button></div>}
      </div>
    );
  }

  const reveal = phase === 'gnReveal' && G.reveal;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><Tag color="brand"><Gauge className="h-3 w-3" /> Devine la note</Tag><span className="text-sm text-muted">Manche {G.round}/{G.total}</span></div>

      <div className="card rounded-2xl p-5 text-center">
        <p className="text-xs text-muted mb-1">PLAYROOM a noté :</p>
        <div className="text-2xl font-display font-bold">{G.subject}</div>
        {iAmHinter && secret && phase === 'gnHint' && <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand/15 text-brand px-3 py-1 text-sm font-bold">Note secrète : {secret.note}/10 🤫</div>}
      </div>

      {/* Indices */}
      {G.clues.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {G.clues.map((c, i) => <Tag key={i} color="muted">{c}</Tag>)}
        </div>
      )}

      {/* Phase indices (donneur) */}
      {phase === 'gnHint' && (
        iAmHinter ? (
          <div className="space-y-2">
            <p className="text-sm text-muted text-center">Fais deviner la note <b className="text-text">{secret?.note}/10</b> avec des mots (interdit d'écrire un chiffre !).</p>
            <div className="flex gap-2">
              <input value={clue} onChange={e => setClue(e.target.value)} onKeyDown={e => e.key === 'Enter' && clue.trim() && (socket.emit('gn:clue', { text: clue }), setClue(''))} maxLength={40} placeholder="Un indice (ex : « plutôt bien »)…"
                className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-brand" />
              <Button disabled={!clue.trim()} onClick={() => { socket.emit('gn:clue', { text: clue }); setClue(''); }}><Send className="h-4 w-4" /></Button>
            </div>
            <p className="text-center text-xs text-muted">{3 - G.clues.length} indice(s) restant(s) · {G.clues.length > 0 && <button onClick={() => socket.emit('gn:ready')} className="text-brand hover:underline">passer à la devinette</button>}</p>
          </div>
        ) : (
          <p className="text-center text-sm text-muted">{opp?.name} te prépare des indices…</p>
        )
      )}

      {/* Phase devinette */}
      {phase === 'gnGuess' && (
        iAmHinter ? <p className="text-center text-sm text-muted">{opp?.name} devine la note…</p> : (
          guess != null ? <p className="text-center text-muted py-4">Note proposée : {guess}/10</p> : (
            <div className="text-center">
              <p className="text-sm text-muted mb-2">À ton avis, quelle note le site a mis ?</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[...Array(11)].map((_, n) => <button key={n} onClick={() => { setGuess(n); socket.emit('gn:guess', { note: n }); }} className="h-11 w-11 rounded-xl bg-surface-2 hover:bg-brand hover:text-white font-display font-bold transition-all">{n}</button>)}
              </div>
            </div>
          )
        )
      )}

      {/* Révélation */}
      {reveal && (
        <div className="text-center animate-popIn space-y-1">
          <div className="flex items-center justify-center gap-6">
            <div><div className="text-3xl font-display font-bold text-muted">{G.reveal.guess}</div><div className="text-xs text-muted">deviné</div></div>
            <span className="text-muted">→</span>
            <div><div className="text-3xl font-display font-bold gradient-text">{G.reveal.note}/10</div><div className="text-xs text-muted">vraie note</div></div>
          </div>
          <p className="font-semibold">{G.reveal.diff === 0 ? '🎯 Pile poil ! +3' : G.reveal.diff === 1 ? '🔥 Tout proche ! +2' : G.reveal.diff === 2 ? '👍 Pas mal ! +1' : 'Loupé 😅 +0'}</p>
          {isHost && <div className="pt-1"><Button onClick={() => socket.emit('game:next')}>{G.round >= G.total ? 'Résultat' : 'Manche suivante'} →</Button></div>}
        </div>
      )}

      <div className="flex justify-center gap-6 text-sm"><span>{me?.name} : <b>{G.scores[playerId]}</b></span><span>{opp?.name} : <b>{G.scores[opp?.id]}</b></span></div>
    </div>
  );
}
function Sc({ name, avatar, v, me }) { return <div className="text-center"><Avatar name={avatar} label={name} size={44} ring={me} /><div className="text-sm font-semibold mt-1">{name}</div><div className="text-2xl font-display font-bold">{v}</div></div>; }
