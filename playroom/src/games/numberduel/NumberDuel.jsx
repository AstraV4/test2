import React, { useEffect, useState } from 'react';
import { Hash, Send, Trophy, Check } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

// Deviner le nombre à 4 chiffres de l'adversaire (façon Mastermind).
export default function NumberDuel({ socket, room, playerId }) {
  const [secret, setSecret] = useState('');
  const [guess, setGuess] = useState('');
  const [over, setOver] = useState(null);
  const n = room.nb;
  const me = room.players.find(p => p.id === playerId);
  const opp = room.players.find(p => p.id !== playerId);
  const isHost = me?.isHost;

  useEffect(() => {
    const onOver = (o) => { setOver(o); if (o.winnerId === playerId) { burstConfetti(); sound.play('win'); } else sound.play('lose'); };
    const onLobby = () => { setOver(null); setSecret(''); setGuess(''); };
    socket.on('nb:over', onOver); socket.on('game:toLobby', onLobby);
    return () => { socket.off('nb:over', onOver); socket.off('game:toLobby', onLobby); };
  }, [socket, playerId]);

  if (!n) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;

  const phase = room.phase;
  const myHistory = n.histories?.[playerId] || [];

  if (phase === 'nbOver' || over) {
    const iWon = (over?.winnerId || n.winnerId) === playerId;
    const secrets = over?.secrets || {};
    return (
      <div className="text-center py-8 space-y-3">
        <Trophy className={`h-12 w-12 mx-auto ${iWon ? 'text-warning' : 'text-muted'}`} />
        <h3 className="font-display font-bold text-2xl">{iWon ? 'Trouvé ! 🎉' : `${opp?.name} a trouvé ton nombre`}</h3>
        <p className="text-muted">Le nombre de {opp?.name} était <b className="text-text font-mono">{secrets[opp?.id] || '????'}</b>.</p>
        {isHost && <div className="flex gap-2 justify-center pt-2"><Button onClick={() => socket.emit('game:next')}>Rejouer</Button><Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button></div>}
      </div>
    );
  }

  // Phase de choix du nombre secret
  if (phase === 'nbSetup') {
    const iReady = n.ready?.[playerId];
    return (
      <div className="max-w-sm mx-auto text-center space-y-4 py-4">
        <Hash className="h-10 w-10 mx-auto text-brand" />
        <h3 className="font-display font-bold text-xl">Choisis ton nombre secret</h3>
        <p className="text-sm text-muted">4 chiffres (1000–9999). Ton adversaire devra le deviner.</p>
        {iReady ? (
          <p className="text-success font-semibold inline-flex items-center gap-1"><Check className="h-4 w-4" /> Nombre choisi — en attente de {opp?.name}…</p>
        ) : (
          <div className="flex gap-2">
            <input value={secret} onChange={e => setSecret(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="Ex : 4567"
              className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:border-brand" />
            <Button disabled={secret.length !== 4} onClick={() => socket.emit('nb:secret', { value: secret })}>Valider</Button>
          </div>
        )}
      </div>
    );
  }

  // Phase de jeu
  const send = () => { if (guess.length !== 4) return; socket.emit('nb:guess', { value: guess }); setGuess(''); };
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted">Devine le nombre à 4 chiffres de <b className="text-text">{opp?.name}</b></p>
      </div>
      <div className="flex gap-2 max-w-sm mx-auto">
        <input value={guess} onChange={e => setGuess(e.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={e => e.key === 'Enter' && send()} inputMode="numeric" autoFocus placeholder="Ton essai…"
          className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:border-brand" />
        <Button onClick={send} disabled={guess.length !== 4}><Send className="h-4 w-4" /></Button>
      </div>

      <div className="max-w-sm mx-auto space-y-1.5">
        {myHistory.length === 0 && <p className="text-center text-xs text-muted py-4">Tes essais s'afficheront ici avec des indices.</p>}
        {[...myHistory].reverse().map((h, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-2.5">
            <span className="font-mono text-lg tracking-[0.3em]">{h.guess}</span>
            <div className="flex gap-2 text-xs">
              <Tag color="success">{h.well} bien placé{h.well > 1 ? 's' : ''}</Tag>
              <Tag color="warning">{h.misplaced} mal placé{h.misplaced > 1 ? 's' : ''}</Tag>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted">🟢 bien placé = bon chiffre au bon endroit · 🟡 mal placé = bon chiffre, mauvaise position</p>
    </div>
  );
}
