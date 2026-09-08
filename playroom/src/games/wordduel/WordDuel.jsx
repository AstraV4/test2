import React, { useEffect, useState } from 'react';
import { Type, Trophy, Check, Heart } from 'lucide-react';
import { Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

const ALPHA = 'abcdefghijklmnopqrstuvwxyz'.split('');

// Deviner le mot secret de l'adversaire, lettre par lettre (façon pendu).
export default function WordDuel({ socket, room, playerId }) {
  const [secret, setSecret] = useState('');
  const [over, setOver] = useState(null);
  const w = room.word2;
  const me = room.players.find(p => p.id === playerId);
  const opp = room.players.find(p => p.id !== playerId);
  const isHost = me?.isHost;

  useEffect(() => {
    const onOver = (o) => { setOver(o); if (o.winnerId === playerId) { burstConfetti(); sound.play('win'); } else sound.play('lose'); };
    const onLobby = () => { setOver(null); setSecret(''); };
    socket.on('word:over', onOver); socket.on('game:toLobby', onLobby);
    return () => { socket.off('word:over', onOver); socket.off('game:toLobby', onLobby); };
  }, [socket, playerId]);

  if (!w) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;
  const phase = room.phase;

  if (phase === 'wordOver' || over) {
    const iWon = (over?.winnerId || w.winnerId) === playerId;
    const secrets = over?.secrets || {};
    return (
      <div className="text-center py-8 space-y-3">
        <Trophy className={`h-12 w-12 mx-auto ${iWon ? 'text-warning' : 'text-muted'}`} />
        <h3 className="font-display font-bold text-2xl">{iWon ? 'Mot trouvé ! 🎉' : `${opp?.name} gagne`}</h3>
        <p className="text-muted">Le mot de {opp?.name} était <b className="text-text">{secrets[opp?.id] || '???'}</b>.</p>
        {isHost && <div className="flex gap-2 justify-center pt-2"><Button onClick={() => socket.emit('game:next')}>Rejouer</Button><Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button></div>}
      </div>
    );
  }

  if (phase === 'wordSetup') {
    const iReady = w.ready?.[playerId];
    return (
      <div className="max-w-sm mx-auto text-center space-y-4 py-4">
        <Type className="h-10 w-10 mx-auto text-brand" />
        <h3 className="font-display font-bold text-xl">Choisis ton mot secret</h3>
        <p className="text-sm text-muted">3 à 12 lettres. Ton adversaire devra le deviner lettre par lettre.</p>
        {iReady ? (
          <p className="text-success font-semibold inline-flex items-center gap-1"><Check className="h-4 w-4" /> Mot choisi — en attente de {opp?.name}…</p>
        ) : (
          <div className="flex gap-2">
            <input value={secret} onChange={e => setSecret(e.target.value.replace(/[^a-zA-Zà-ÿ]/g, ''))} placeholder="Ton mot…" autoComplete="off"
              className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-center text-lg outline-none focus:border-brand" />
            <Button disabled={secret.replace(/[^a-zA-Zà-ÿ]/g, '').length < 3} onClick={() => socket.emit('word:secret', { value: secret })}>Valider</Button>
          </div>
        )}
      </div>
    );
  }

  // Phase de jeu
  const view = w.views?.[playerId] || '';
  const tried = w.tried?.[playerId] || [];
  const errors = w.errors?.[playerId] || 0;
  const maxErrors = w.maxErrors || 8;
  const tryLetter = (L) => { if (!tried.includes(L)) socket.emit('word:letter', { letter: L }); };

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-muted">Devine le mot de <b className="text-text">{opp?.name}</b> ({w.lens?.[playerId]} lettres)</p>

      {/* Mot masqué */}
      <div className="flex justify-center gap-1.5 flex-wrap">
        {view.split('').map((ch, i) => (
          <span key={i} className={`inline-flex h-11 w-9 items-center justify-center rounded-lg font-display font-bold text-xl ${ch === '_' ? 'bg-surface-2 text-transparent' : 'bg-brand/15 text-brand'}`}>{ch === '_' ? '?' : ch.toUpperCase()}</span>
        ))}
      </div>

      {/* Erreurs (cœurs) */}
      <div className="flex justify-center items-center gap-1">
        {[...Array(maxErrors)].map((_, i) => <Heart key={i} className={`h-4 w-4 ${i < maxErrors - errors ? 'text-danger fill-danger' : 'text-border'}`} />)}
        <span className="text-xs text-muted ml-2">{maxErrors - errors} essai(s) restant(s)</span>
      </div>

      {/* Clavier */}
      <div className="flex flex-wrap gap-1.5 justify-center max-w-md mx-auto">
        {ALPHA.map(L => {
          const used = tried.includes(L);
          const inWord = used && view.includes(L);
          return (
            <button key={L} disabled={used} onClick={() => tryLetter(L)}
              className={`h-9 w-9 rounded-lg font-semibold uppercase text-sm transition-all ${used ? (inWord ? 'bg-success/20 text-success' : 'bg-surface-2 text-muted/40 line-through') : 'bg-surface-2 hover:bg-brand hover:text-white'}`}>
              {L}
            </button>
          );
        })}
      </div>
    </div>
  );
}
