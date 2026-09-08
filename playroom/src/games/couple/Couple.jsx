import React, { useEffect, useState } from 'react';
import { Heart, Check, Flame } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import ShareCard from '../../components/ShareCard.jsx';
import { sound } from '../../lib/sound.js';

// Compatibilité : répondez en même temps, plus vous répondez pareil, plus l'affinité monte.
export default function Couple({ socket, room, playerId }) {
  const [answered, setAnswered] = useState(false);
  const [over, setOver] = useState(null);
  const [streak, setStreak] = useState(null);
  const c = room.couple;
  const me = room.players.find(p => p.id === playerId);
  const opp = room.players.find(p => p.id !== playerId);
  const isHost = me?.isHost;

  useEffect(() => {
    const onReveal = (r) => { sound.play(r.match ? 'win' : 'tick'); if (r.match) burstConfetti(18); };
    const onOver = (o) => { setOver(o); burstConfetti(); sound.play('win'); };
    const onLobby = () => setOver(null);
    const onStreak = (st) => setStreak(st);
    socket.on('couple:reveal', onReveal); socket.on('couple:over', onOver); socket.on('game:toLobby', onLobby); socket.on('duo:streak', onStreak);
    return () => { socket.off('couple:reveal', onReveal); socket.off('couple:over', onOver); socket.off('game:toLobby', onLobby); socket.off('duo:streak', onStreak); };
  }, [socket]);
  useEffect(() => { setAnswered(false); }, [c?.round]);

  if (!c) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;
  const phase = room.phase;

  if (phase === 'coupleOver' || over) {
    const res = over || room.couple?.result || { affinity: 0, matches: 0, total: 0 };
    const msg = res.affinity >= 80 ? 'Incroyable complicité ! 💞' : res.affinity >= 50 ? 'Belle entente !' : res.affinity >= 25 ? 'Vous vous complétez !' : 'Les opposés s\u2019attirent 😄';
    return (
      <div className="py-4 space-y-4 max-w-lg mx-auto">
        <div className="text-center">
          <h3 className="font-display font-bold text-2xl">Compatibilité : {res.affinity}%</h3>
          <p className="text-muted">{msg}</p>
          {streak?.streak > 1 && <p className="text-sm text-warning font-semibold mt-1 inline-flex items-center gap-1"><Flame className="h-4 w-4" /> {streak.streak} jours de suite à jouer ensemble !</p>}
        </div>
        <ShareCard
          title="Notre compatibilité"
          statLine={`${res.affinity}% 💞`}
          subtitle={`${res.matches} réponses en commun sur ${res.total}${streak?.streak > 1 ? ` · ${streak.streak} jours de suite 🔥` : ''}`}
          players={[{ name: me?.name, avatar: me?.avatar }, { name: opp?.name, avatar: opp?.avatar }]}
          accent="#ec4899" emoji="💞"
        />
        {isHost && <div className="flex gap-2 justify-center"><Button onClick={() => socket.emit('game:next')}>Rejouer</Button><Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button></div>}
      </div>
    );
  }

  const reveal = phase === 'coupleReveal' && c.reveal;
  const affinityNow = c.round ? Math.round((c.matches / c.round) * 100) || 0 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tag color="danger"><Heart className="h-3 w-3" /> Compatibilité</Tag>
        <span className="text-sm text-muted">Question {c.round}/{c.total} · {affinityNow}% d'affinité</span>
      </div>

      <div className="card rounded-2xl p-6 text-center"><h3 className="font-display font-bold text-xl">{c.question}</h3></div>

      <div className="grid sm:grid-cols-2 gap-2">
        {c.options.map((opt, i) => {
          const mine = c.reveal ? c.reveal.answers[playerId] === i : false;
          const theirs = c.reveal ? c.reveal.answers[opp?.id] === i : false;
          return (
            <button key={i} disabled={answered || reveal} onClick={() => { setAnswered(true); socket.emit('couple:answer', { choice: i }); }}
              className={`rounded-2xl border-2 px-4 py-4 font-semibold transition-all ${(mine || theirs) ? 'border-brand bg-brand/10' : 'border-border bg-surface-2'} ${!answered && !reveal ? 'hover:border-brand/60 hover:-translate-y-0.5' : ''}`}>
              <div>{opt}</div>
              {reveal && (
                <div className="flex justify-center gap-2 mt-2 text-xs">
                  {mine && <span className="inline-flex items-center gap-1 text-brand"><Avatar name={me?.avatar} label={me?.name} size={16} /> toi</span>}
                  {theirs && <span className="inline-flex items-center gap-1 text-accent"><Avatar name={opp?.avatar} label={opp?.name} size={16} /> {opp?.name}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {!reveal ? (
        <p className="text-center text-sm text-muted">{answered ? 'En attente de l\u2019autre…' : 'Réponds en pensant à ce que l\u2019autre dirait aussi !'}</p>
      ) : (
        <p className="text-center font-semibold">{c.reveal.match ? '💞 Même réponse !' : '↔️ Réponses différentes'}</p>
      )}
    </div>
  );
}
