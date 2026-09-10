import React, { useEffect, useState } from 'react';
import { Trophy, Send, Check, X } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

export default function TwoLies({ socket, room, playerId }) {
  const [s0, setS0] = useState(''); const [s1, setS1] = useState(''); const [s2, setS2] = useState('');
  const [lie, setLie] = useState(0);
  const [over, setOver] = useState(null);
  const t = room.tl;
  const me = room.players.find(p => p.id === playerId);
  const opp = room.players.find(p => p.id !== playerId);
  const isHost = me?.isHost;

  useEffect(() => {
    const onOver = (o) => { setOver(o); if (o.winnerId === playerId) { burstConfetti(); sound.play('win'); } else sound.play(o.winnerId === 'draw' ? 'ok' : 'lose'); };
    const onReveal = (r) => sound.play(r.correct ? 'ok' : 'error');
    const onLobby = () => setOver(null);
    socket.on('twolies:over', onOver); socket.on('twolies:reveal', onReveal); socket.on('game:toLobby', onLobby);
    return () => { socket.off('twolies:over', onOver); socket.off('twolies:reveal', onReveal); socket.off('game:toLobby', onLobby); };
  }, [socket, playerId]);
  useEffect(() => { setS0(''); setS1(''); setS2(''); setLie(0); }, [t?.round]);

  if (!t) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;
  const phase = room.phase;
  const iAmTeller = t.tellerId === playerId;

  if (phase === 'tlOver' || over) {
    const res = over || room.tlResult; const iWon = res.winnerId === playerId;
    return (
      <div className="text-center py-6 space-y-4">
        <Trophy className={`h-12 w-12 mx-auto ${res.winnerId === 'draw' ? 'text-muted' : iWon ? 'text-warning' : 'text-muted'}`} />
        <h3 className="font-display font-bold text-2xl">{res.winnerId === 'draw' ? 'Égalité !' : iWon ? 'Bravo ! 🎉' : `${opp?.name} gagne`}</h3>
        <div className="flex items-center justify-center gap-6"><Score name={me?.name} avatar={me?.avatar} v={res.scores[playerId]} me /><span className="text-xl text-muted">—</span><Score name={opp?.name} avatar={opp?.avatar} v={res.scores[opp?.id]} /></div>
        {isHost && <div className="flex gap-2 justify-center"><Button onClick={() => socket.emit('game:next')}>Rejouer</Button><Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button></div>}
      </div>
    );
  }

  // Écriture (teller)
  if (phase === 'tlWrite') {
    if (!iAmTeller) return <div className="py-12 text-center text-muted"><Spinner className="mx-auto mb-2" /> {t && room.players.find(p => p.id === t.tellerId)?.name} prépare ses affirmations…</div>;
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Écris <b className="text-text">2 vérités</b> et <b className="text-text">1 mensonge</b> sur toi. Coche celle qui est fausse — {opp?.name} devra la trouver.</p>
        {[[s0, setS0], [s1, setS1], [s2, setS2]].map(([v, set], i) => (
          <button key={i} type="button" onClick={() => setLie(i)} className={`w-full flex items-center gap-2 rounded-xl border-2 p-1.5 text-left ${lie === i ? 'border-danger' : 'border-border'}`}>
            <input value={v} onChange={e => set(e.target.value)} onClick={e => e.stopPropagation()} maxLength={80} placeholder={`Affirmation ${i + 1}`} className="flex-1 bg-transparent px-3 py-2 text-sm outline-none" />
            <span className={`text-[11px] px-2 ${lie === i ? 'text-danger' : 'text-muted'}`}>{lie === i ? '✗ mensonge' : 'vérité'}</span>
          </button>
        ))}
        <Button className="w-full" disabled={!s0.trim() || !s1.trim() || !s2.trim()} onClick={() => socket.emit('twolies:write', { statements: [s0, s1, s2], lie })}><Send className="h-4 w-4" /> Envoyer</Button>
      </div>
    );
  }

  // Devinette / révélation
  const reveal = phase === 'tlReveal' && t.reveal;
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted">{iAmTeller ? `${opp?.name} cherche ton mensonge…` : `Quelle affirmation de ${room.players.find(p => p.id === t.tellerId)?.name} est FAUSSE ?`}</p>
      <div className="space-y-2">
        {(t.statements || []).map((txt, i) => {
          const isLie = reveal && t.reveal.lieIndex === i;
          const picked = reveal && t.reveal.guess === i;
          return (
            <button key={i} disabled={iAmTeller || reveal} onClick={() => socket.emit('twolies:guess', { index: i })}
              className={`w-full text-left rounded-xl border-2 px-4 py-3 text-sm transition-all ${isLie ? 'border-danger bg-danger/10' : picked ? 'border-brand' : 'border-border bg-surface-2'} ${!iAmTeller && !reveal ? 'hover:border-brand/50' : ''}`}>
              {txt} {isLie && <Tag color="danger" className="ml-2">Mensonge 🤥</Tag>} {reveal && picked && !isLie && <Tag color="muted" className="ml-2">choix</Tag>}
            </button>
          );
        })}
      </div>
      {reveal && <p className="text-center font-semibold">{t.reveal.correct ? '✅ Mensonge démasqué !' : '🙈 Raté, bien joué au menteur !'}</p>}
      {reveal && isHost && <div className="text-center"><Button onClick={() => socket.emit('game:next')}>{t.round >= t.total ? 'Résultat' : 'Manche suivante'} →</Button></div>}
      <div className="flex justify-center gap-6 text-sm"><span>{me?.name} : <b>{t.scores[playerId]}</b></span><span>{opp?.name} : <b>{t.scores[opp?.id]}</b></span></div>
    </div>
  );
}
function Score({ name, avatar, v, me }) { return <div className="text-center"><Avatar name={avatar} label={name} size={44} ring={me} /><div className="text-sm font-semibold mt-1">{name}</div><div className="text-2xl font-display font-bold">{v}</div></div>; }
