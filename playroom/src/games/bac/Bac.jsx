import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Send, Clock, Check, X } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { useCountdown } from '../../lib/hooks.js';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

// Le Bac (petit bac) à 2 : une lettre, des catégories à remplir en temps limité, puis comparaison.
export default function Bac({ socket, room, playerId, endsAt }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [over, setOver] = useState(null);
  const bc = room.bac;
  const me = room.players.find(p => p.id === playerId);
  const opp = room.players.find(p => p.id !== playerId);
  const isHost = me?.isHost;
  const left = useCountdown(endsAt);
  const prevRound = useRef(0);

  useEffect(() => {
    const onReveal = () => sound.play('ok');
    const onOver = (o) => { setOver(o); if (o.winnerId === playerId) { burstConfetti(); sound.play('win'); } else sound.play(o.winnerId === 'draw' ? 'ok' : 'lose'); };
    const onLobby = () => { setOver(null); setAnswers({}); setSubmitted(false); };
    socket.on('bac:reveal', onReveal); socket.on('bac:over', onOver); socket.on('game:toLobby', onLobby);
    return () => { socket.off('bac:reveal', onReveal); socket.off('bac:over', onOver); socket.off('game:toLobby', onLobby); };
  }, [socket, playerId]);

  // reset à chaque nouvelle manche
  useEffect(() => { if (bc && bc.round !== prevRound.current) { prevRound.current = bc.round; setAnswers({}); setSubmitted(false); } }, [bc?.round]);
  // auto-submit quand le temps est écoulé
  useEffect(() => { if (room.phase === 'bacPlay' && left === 0 && !submitted && bc) doSubmit(); /* eslint-disable-next-line */ }, [left]);

  if (!bc) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;
  const phase = room.phase;

  const doSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    const arr = bc.categories.map((_, i) => answers[i] || '');
    socket.emit('bac:submit', { answers: arr });
    sound.play('click');
  };

  // Fin de partie
  if (phase === 'bacOver' || over) {
    const res = over || room.bacResult;
    const [a, b] = res.ids; const iWon = res.winnerId === playerId;
    return (
      <div className="text-center py-6 space-y-4">
        <Trophy className={`h-12 w-12 mx-auto ${res.winnerId === 'draw' ? 'text-muted' : iWon ? 'text-warning' : 'text-muted'}`} />
        <h3 className="font-display font-bold text-2xl">{res.winnerId === 'draw' ? 'Égalité !' : iWon ? 'Victoire ! 🎉' : `${opp?.name} gagne`}</h3>
        <div className="flex items-center justify-center gap-6">
          <div className="text-center"><Avatar name={me?.avatar} label={me?.name} size={44} ring /><div className="text-sm font-semibold mt-1">{me?.name}</div><div className="text-2xl font-display font-bold">{res.scores[playerId]}</div></div>
          <span className="text-xl text-muted">—</span>
          <div className="text-center"><Avatar name={opp?.avatar} label={opp?.name} size={44} /><div className="text-sm font-semibold mt-1">{opp?.name}</div><div className="text-2xl font-display font-bold">{res.scores[opp?.id]}</div></div>
        </div>
        {isHost && <div className="flex gap-2 justify-center"><Button onClick={() => socket.emit('game:next')}>Rejouer</Button><Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button></div>}
      </div>
    );
  }

  // Révélation de manche
  if (phase === 'bacReveal' && bc.reveal) {
    const r = bc.reveal; const [a, b] = r.ids;
    return (
      <div className="space-y-3">
        <div className="text-center"><Tag color="brand" className="text-base px-4 py-1">Lettre : {r.letter}</Tag></div>
        <div className="space-y-2">
          {r.rows.map((row, i) => (
            <div key={i} className="card rounded-xl p-3">
              <div className="text-xs text-muted mb-1">{row.cat}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <AnswerCell name={r.players[playerId]} value={playerId === a ? row.a : row.b} ok={playerId === a ? row.okA : row.okB} pts={playerId === a ? row.pa : row.pb} me />
                <AnswerCell name={opp?.name} value={playerId === a ? row.b : row.a} ok={playerId === a ? row.okB : row.okA} pts={playerId === a ? row.pb : row.pa} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6 text-sm pt-1">
          <span>{me?.name} : <b>{r.scores[playerId]}</b></span>
          <span>{opp?.name} : <b>{r.scores[opp?.id]}</b></span>
        </div>
        {isHost && <div className="text-center"><Button onClick={() => socket.emit('game:next')}>{bc.round >= bc.total ? 'Voir le résultat' : 'Manche suivante'} →</Button></div>}
      </div>
    );
  }

  // Phase de jeu
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Manche {bc.round}/{bc.total}</span>
          <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white font-display font-bold text-2xl shadow-glow">{bc.letter}</span>
        </div>
        <span className={`inline-flex items-center gap-1 font-mono font-bold ${left <= 15 ? 'text-danger' : 'text-muted'}`}><Clock className="h-4 w-4" /> {left}s</span>
      </div>
      <p className="text-sm text-muted">Remplis chaque catégorie avec un mot commençant par <b className="text-brand">{bc.letter}</b>.</p>

      {submitted ? (
        <div className="text-center py-8 text-muted"><Check className="h-8 w-8 mx-auto text-success mb-2" /> Réponses envoyées ! En attente de {opp?.name}…</div>
      ) : (
        <>
          <div className="space-y-2">
            {bc.categories.map((cat, i) => (
              <div key={i} className="flex items-center gap-3">
                <label className="w-32 flex-none text-sm text-muted">{cat}</label>
                <input value={answers[i] || ''} onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))} maxLength={30}
                  placeholder={`${bc.letter}…`} className="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand" />
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={doSubmit}><Send className="h-4 w-4" /> J'ai terminé</Button>
        </>
      )}
    </div>
  );
}

function AnswerCell({ name, value, ok, pts, me }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${ok ? 'bg-success/10' : value ? 'bg-danger/10' : 'bg-surface-2'}`}>
      <div className="text-[10px] text-muted">{name}{me && ' (toi)'}</div>
      <div className="flex items-center justify-between">
        <span className="font-medium truncate">{value || '—'}</span>
        {value && (ok ? <span className="text-xs text-success font-bold">+{pts}</span> : <X className="h-3.5 w-3.5 text-danger" />)}
      </div>
    </div>
  );
}
