import React, { useEffect, useState } from 'react';
import { Avatar } from './ui/index.jsx';
import { burstConfetti } from './PlayAgain.jsx';
import { sound } from '../lib/sound.js';

// Événements de fin de partie émis par le serveur (tous les jeux).
const OVER_EVENTS = [
  'duel:over', 'nb:over', 'word:over', 'bac:over', 'twolies:over', 'gn:over',
  'couple:over', 'wyr:over', 'assoc:over', 'rate:over', 'nousquiz:over', 'party:over', 'draw:over',
];

// Mode fête : quand une partie se termine, tout l'écran s'illumine avec une célébration.
export default function PartyMode({ socket, room, playerId }) {
  const [fx, setFx] = useState(null); // { label, emoji, winner }

  useEffect(() => {
    if (!socket) return;
    let clr;
    const celebrate = (payload) => {
      const players = room?.players || [];
      let label = 'Bien joué !'; let emoji = '🎉'; let winner = null;
      const wid = payload?.winnerId;
      if (wid === 'draw') { label = 'Égalité !'; emoji = '🤝'; }
      else if (wid) {
        winner = players.find(p => p.id === wid) || null;
        if (wid === playerId) { label = 'Victoire !'; emoji = '🏆'; }
        else { label = `${winner?.name || 'Bravo'} gagne`; emoji = '🎉'; }
      } else {
        // jeux "affinité" (compatibilité, tu préfères, assoc, note ça…) : célébration douce
        if (payload && typeof payload.affinity === 'number') { label = `${payload.affinity}% ensemble`; emoji = '💞'; }
      }
      setFx({ label, emoji, winner });
      try { burstConfetti(70); } catch { /* ignore */ }
      sound.play('win');
      clearTimeout(clr);
      clr = setTimeout(() => setFx(null), 2600);
    };
    OVER_EVENTS.forEach(ev => socket.on(ev, celebrate));
    return () => { OVER_EVENTS.forEach(ev => socket.off(ev, celebrate)); clearTimeout(clr); };
  }, [socket, room, playerId]);

  if (!fx) return null;
  return (
    <div className="party-overlay" aria-hidden>
      <div className="party-glow" />
      <div className="party-rays" />
      {/* Émojis qui montent */}
      {['🎉', '✨', '🎊', '⭐', '💛', '🎈'].map((e, i) => (
        <span key={i} className="absolute text-3xl" style={{ left: `${12 + i * 14}%`, bottom: '18%', animation: `floatUp ${1.8 + (i % 3) * 0.4}s ease-out ${i * 0.12}s forwards` }}>{e}</span>
      ))}
      <div className="party-badge relative text-center">
        <div className="text-6xl mb-2">{fx.emoji}</div>
        {fx.winner && <div className="mx-auto mb-2 w-fit"><Avatar name={fx.winner.avatar} label={fx.winner.name} size={56} ring /></div>}
        <div className="font-display font-bold text-3xl md:text-4xl text-white drop-shadow-lg">{fx.label}</div>
      </div>
    </div>
  );
}
