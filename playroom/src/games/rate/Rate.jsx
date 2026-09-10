import React, { useEffect, useState } from 'react';
import { Star, Send, Heart, Shuffle } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

// Note ça : un joueur propose un sujet, les DEUX le notent /10 en secret, on compare.
export default function Rate({ socket, room, playerId }) {
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState(null);
  const [over, setOver] = useState(null);
  const R = room.rate;
  const me = room.players.find(p => p.id === playerId);
  const opp = room.players.find(p => p.id !== playerId);
  const isHost = me?.isHost;

  useEffect(() => {
    const onReveal = (r) => { sound.play(r.diff <= 1 ? 'win' : 'tick'); if (r.diff <= 1) burstConfetti(14); };
    const onOver = (o) => { setOver(o); burstConfetti(); sound.play('win'); };
    const onLobby = () => setOver(null);
    socket.on('rate:reveal', onReveal); socket.on('rate:over', onOver); socket.on('game:toLobby', onLobby);
    return () => { socket.off('rate:reveal', onReveal); socket.off('rate:over', onOver); socket.off('game:toLobby', onLobby); };
  }, [socket]);
  useEffect(() => { setSubject(''); setNote(null); }, [R?.round]);

  if (!R) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;
  const phase = room.phase;
  const iAmProposer = R.proposerId === playerId;

  if (phase === 'rateOver' || over) {
    const res = over || room.rateResult;
    const msg = res.affinity >= 70 ? 'Mêmes goûts ! 💞' : res.affinity >= 40 ? 'Souvent d\u2019accord !' : 'Vous adorez débattre 😄';
    return (
      <div className="py-4 text-center space-y-3">
        <div className="relative inline-block"><Heart className="h-16 w-16 text-rose-400 fill-rose-400/20" /><span className="absolute inset-0 flex items-center justify-center font-display font-bold">{res.affinity}%</span></div>
        <h3 className="font-display font-bold text-2xl">D'accord {res.matches} fois sur {res.total}</h3>
        <p className="font-semibold">{msg}</p>
        {isHost && <div className="flex gap-2 justify-center"><Button onClick={() => socket.emit('game:next')}>Rejouer</Button><Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button></div>}
      </div>
    );
  }

  // Le proposeur choisit le sujet
  if (phase === 'rateWrite') {
    if (!iAmProposer) return <div className="py-12 text-center text-muted"><Spinner className="mx-auto mb-2" /> {room.players.find(p => p.id === R.proposerId)?.name} choisit un sujet à noter…</div>;
    return (
      <div className="space-y-3 text-center">
        <Star className="h-9 w-9 mx-auto text-warning" />
        <p className="text-sm text-muted">Propose un truc à noter — vous le noterez tous les deux sur 10, chacun de son côté.</p>
        <div className="flex gap-2 max-w-sm mx-auto">
          <input value={subject} onChange={e => setSubject(e.target.value)} onKeyDown={e => e.key === 'Enter' && subject.trim() && socket.emit('rate:subject', { subject })} maxLength={40} autoFocus placeholder="Ex : McDo, les lundis…"
            className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />
          <Button disabled={!subject.trim()} onClick={() => socket.emit('rate:subject', { subject })}><Send className="h-4 w-4" /></Button>
        </div>
        <button onClick={() => setSubject(R.suggestion)} className="text-xs text-muted hover:text-text inline-flex items-center gap-1"><Shuffle className="h-3.5 w-3.5" /> Idée : {R.suggestion}</button>
      </div>
    );
  }

  // Notation secrète
  const reveal = phase === 'rateReveal' && R.reveal;
  return (
    <div className="space-y-4 text-center">
      <div className="flex items-center justify-between"><Tag color="warning"><Star className="h-3 w-3" /> Note ça</Tag><span className="text-sm text-muted">Sujet {R.round}/8</span></div>
      <div className="card rounded-2xl py-6"><div className="text-xs text-muted mb-1">Notez sur 10 :</div><div className="text-2xl font-display font-bold">{R.subject}</div></div>

      {reveal ? (
        <div className="animate-popIn">
          <div className="flex items-center justify-center gap-8 py-2">
            <NoteBig name={me?.name} v={R.reveal.notes[playerId]} me />
            <span className="text-xl text-muted">vs</span>
            <NoteBig name={opp?.name} v={R.reveal.notes[opp?.id]} />
          </div>
          <p className="font-semibold mt-1">{R.reveal.diff === 0 ? '🎯 Exactement pareil !' : R.reveal.diff === 1 ? '💞 Presque pareil !' : `Écart de ${R.reveal.diff} points`}</p>
        </div>
      ) : note != null ? (
        <p className="py-4 text-muted">Note envoyée ({note}/10). En attente de {opp?.name}…</p>
      ) : (
        <div>
          <div className="flex flex-wrap gap-2 justify-center">
            {[...Array(11)].map((_, n) => (
              <button key={n} onClick={() => { setNote(n); socket.emit('rate:note', { note: n }); sound.play('click'); }}
                className="h-11 w-11 rounded-xl bg-surface-2 hover:bg-brand hover:text-white font-display font-bold transition-all">{n}</button>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">De 0 (nul) à 10 (parfait)</p>
        </div>
      )}
    </div>
  );
}
function NoteBig({ name, v, me }) { return <div><div className="text-4xl font-display font-bold gradient-text">{v ?? '—'}<span className="text-lg text-muted">/10</span></div><div className="text-xs text-muted mt-1">{name}{me && ' (toi)'}</div></div>; }
