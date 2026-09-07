import React, { useEffect, useState } from 'react';
import { Trophy, Check, Users2, Scale, Flame, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Avatar, Button, Tag } from '../../components/ui/index.jsx';
import { useCountdown } from '../../lib/hooks.js';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

// Trois formats à voter, pilotés par le serveur. L'état complet arrive via room.party
// (question, options, qui a voté, révélation) — pas besoin de synchro séparée.
export default function Party({ socket, room, playerId, endsAt }) {
  const [myVote, setMyVote] = useState(null);
  const left = useCountdown(endsAt);
  const me = room.players.find(p => p.id === playerId);
  const isHost = me?.isHost;
  const party = room.party;
  const phase = room.phase;

  // Réinitialise mon vote à chaque nouvelle manche
  useEffect(() => { setMyVote(null); }, [party?.turn]);
  useEffect(() => {
    const onReveal = () => sound.play('ok');
    const onOver = () => { burstConfetti(); sound.play('win'); };
    socket.on('party:reveal', onReveal); socket.on('party:over', onOver);
    return () => { socket.off('party:reveal', onReveal); socket.off('party:over', onOver); };
  }, [socket]);

  const vote = (choice) => { if (myVote !== null && party?.format !== 'most') return; setMyVote(choice); socket.emit('party:vote', { choice }); sound.play('click'); };

  // Podium final
  if (phase === 'partyOver' && room.party == null) { /* fallback */ }
  if (phase === 'partyOver' || (party?.reveal && phase === 'partyOver')) {
    return <PartyPodium podium={room.partyPodium} socket={socket} isHost={isHost} />;
  }
  // Le podium arrive via event ; on lit aussi un éventuel room.partyPodium
  if (phase === 'partyOver') return <PartyPodium podium={room.partyPodium} socket={socket} isHost={isHost} />;

  if (!party) return <div className="py-16 text-center text-muted">Préparation…</div>;

  const revealed = !!party.reveal;
  const votedCount = party.votedIds?.length || 0;
  const totalPlayers = room.players.filter(p => p.connected).length;
  const FormatIcon = party.format === 'wyr' ? Scale : party.format === 'most' ? Users2 : Flame;
  const formatLabel = party.format === 'wyr' ? 'Tu préfères' : party.format === 'most' ? 'Le plus susceptible' : 'Hot Take';

  return (
    <div className="space-y-4">
      {/* En-tête manche */}
      <div className="flex items-center justify-between">
        <Tag color="brand"><FormatIcon className="h-3 w-3" /> {formatLabel}</Tag>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">Manche {party.turn}/{party.total}</span>
          {!revealed && left > 0 && <span className={`font-mono font-bold ${left <= 5 ? 'text-danger' : 'text-muted'}`}>{left}s</span>}
        </div>
      </div>

      {/* Question */}
      <div className="card rounded-2xl p-6 text-center">
        <h3 className="font-display font-bold text-xl md:text-2xl">{party.prompt}</h3>
      </div>

      {/* Zone de vote / résultats */}
      {party.format === 'most' ? (
        <MostGrid party={party} myVote={myVote} revealed={revealed} onVote={vote} players={room.players} />
      ) : (
        <TwoChoice party={party} myVote={myVote} revealed={revealed} onVote={vote} />
      )}

      {/* Progression des votes */}
      {!revealed ? (
        <p className="text-center text-sm text-muted">{votedCount}/{totalPlayers} ont voté{myVote !== null && ' · ton vote est pris en compte'}</p>
      ) : (
        <div className="text-center">
          {isHost ? (
            <Button onClick={() => socket.emit('game:next')}>{party.turn >= party.total ? 'Voir le classement' : 'Manche suivante'} →</Button>
          ) : <p className="text-sm text-muted">Manche suivante dans un instant…</p>}
        </div>
      )}

      {/* Scores en direct */}
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

// Deux choix (Tu préfères / Hot Take)
function TwoChoice({ party, myVote, revealed, onVote }) {
  const counts = party.reveal?.counts || [0, 0];
  const total = counts[0] + counts[1];
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const colors = party.format === 'hot' ? [['#34d399', ThumbsUp], ['#f43f5e', ThumbsDown]] : [['#7c5cff', null], ['#22d3ee', null]];
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {party.options.map((opt, i) => {
        const [col, Icon] = colors[i];
        const mine = myVote === i;
        return (
          <button key={i} disabled={revealed || myVote !== null} onClick={() => onVote(i)}
            className={`relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-all ${mine ? 'border-brand' : 'border-border'} ${!revealed && myVote === null ? 'hover:border-brand/60 hover:-translate-y-0.5' : ''} disabled:cursor-default`}>
            {revealed && <div className="absolute inset-0 opacity-15 transition-all" style={{ width: `${pct(counts[i])}%`, background: col }} />}
            <div className="relative flex items-center justify-between gap-2">
              <span className="font-semibold flex items-center gap-2">{Icon && <Icon className="h-5 w-5" style={{ color: col }} />}{opt}</span>
              {mine && !revealed && <Check className="h-5 w-5 text-brand" />}
              {revealed && <span className="font-bold" style={{ color: col }}>{pct(counts[i])}%</span>}
            </div>
            {revealed && <div className="relative text-xs text-muted mt-1">{counts[i]} vote{counts[i] > 1 ? 's' : ''}</div>}
          </button>
        );
      })}
    </div>
  );
}

// Grille de joueurs (Le plus susceptible de)
function MostGrid({ party, myVote, revealed, onVote, players }) {
  const tally = party.reveal?.tally || {};
  const winnerId = party.reveal?.winnerId;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {party.options.map(o => {
        const count = tally[o.id] || 0;
        const isWinner = revealed && o.id === winnerId;
        const mine = myVote === o.id;
        return (
          <button key={o.id} disabled={revealed} onClick={() => onVote(o.id)}
            className={`rounded-xl border-2 p-3 flex flex-col items-center gap-1 transition-all ${isWinner ? 'border-warning bg-warning/10' : mine ? 'border-brand bg-brand/10' : 'border-border'} ${!revealed ? 'hover:border-brand/60' : ''} disabled:cursor-default`}>
            <Avatar name={o.avatar} label={o.name} size={40} ring={isWinner} />
            <span className="text-sm font-semibold truncate max-w-full">{o.name}</span>
            {revealed ? <span className={`text-xs font-bold ${isWinner ? 'text-warning' : 'text-muted'}`}>{isWinner && '👑 '}{count} vote{count > 1 ? 's' : ''}</span>
              : mine ? <Check className="h-4 w-4 text-brand" /> : <span className="text-xs text-muted">voter</span>}
          </button>
        );
      })}
    </div>
  );
}

function PartyPodium({ podium = [], socket, isHost }) {
  return (
    <div className="space-y-4">
      <div className="text-center"><Trophy className="h-10 w-10 mx-auto text-warning mb-2" /><h3 className="font-display font-bold text-2xl">Fin de la soirée !</h3></div>
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
