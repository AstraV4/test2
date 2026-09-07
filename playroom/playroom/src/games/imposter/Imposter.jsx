import React, { useEffect, useState } from 'react';
import { Ghost, Crown, Send, Vote, Play, ArrowRight, DoorOpen, Eye, EyeOff } from 'lucide-react';
import { Button, Avatar, Tag, Spinner } from '../../components/ui/index.jsx';
import { useCountdown } from '../../lib/hooks.js';
import { sound } from '../../lib/sound.js';

// Reçoit le socket, l'état du salon et l'id du joueur ; pilote uniquement l'affichage.
export default function Imposter({ socket, room, playerId, endsAt }) {
  const [role, setRole] = useState(null);     // { role, theme, word }
  const [clues, setClues] = useState([]);     // { name, clue }
  const [clueTurn, setClueTurn] = useState(null); // { currentId, index, total }
  const [clueText, setClueText] = useState('');
  const [vote, setVote] = useState(null);
  const [result, setResult] = useState(null);
  const [showRole, setShowRole] = useState(true);
  const left = useCountdown(endsAt);

  const me = room.players.find(p => p.id === playerId);
  const isHost = me?.isHost;
  const phase = room.phase;

  useEffect(() => {
    const onRole = (r) => { setRole(r); setClues([]); setResult(null); setVote(null); sound.play('notify'); };
    const onClue = (c) => setClues(prev => [...prev, c]);
    const onClueTurn = (t) => { setClueTurn(t); };
    const onResult = (r) => { setResult(r); sound.play(r.crewWins ? 'win' : 'lose'); };
    const onToLobby = () => { setRole(null); setClues([]); setResult(null); setVote(null); };
    socket.on('game:role', onRole);
    socket.on('game:clue', onClue);
    socket.on('game:clueTurn', onClueTurn);
    socket.on('game:result', onResult);
    socket.on('game:toLobby', onToLobby);
    return () => { socket.off('game:role', onRole); socket.off('game:clue', onClue); socket.off('game:clueTurn', onClueTurn); socket.off('game:result', onResult); socket.off('game:toLobby', onToLobby); };
  }, [socket]);

  const isMyClueTurn = phase === 'clues' && clueTurn && clueTurn.currentId === playerId;
  const sendClue = () => { if (!clueText.trim()) return; socket.emit('game:clue', { text: clueText }); setClueText(''); };
  const castVote = (id) => { setVote(id); socket.emit('game:vote', { targetId: id }); sound.play('click'); };

  /* ---------- REVEAL : rôle secret ---------- */
  if (phase === 'reveal') {
    const imp = role?.role === 'imposter';
    return (
      <div className="text-center">
        <p className="text-sm text-muted mb-3">Ton rôle secret…</p>
        <div className={`mx-auto max-w-sm rounded-3xl p-8 border-2 ${imp ? 'border-danger/60 bg-danger/10' : 'border-brand/50 bg-brand/10'}`}>
          {showRole ? (
            <>
              <Ghost className={`h-12 w-12 mx-auto mb-3 ${imp ? 'text-danger' : 'text-brand'}`} />
              <div className="text-2xl font-display font-bold mb-1">{imp ? 'Tu es l\u2019IMPOSTEUR' : 'Équipage'}</div>
              {imp ? (
                <p className="text-sm text-muted">Thème : <b className="text-text">{role.theme}</b>. Tu ne connais pas le mot : fais semblant !</p>
              ) : (
                <p className="text-sm text-muted">Le mot est <b className="text-text text-lg">{role?.word}</b> <span className="block mt-1 text-xs">(thème : {role?.theme})</span></p>
              )}
            </>
          ) : (
            <div className="py-8 text-muted"><EyeOff className="h-10 w-10 mx-auto mb-2" />Rôle masqué</div>
          )}
        </div>
        <button onClick={() => setShowRole(s => !s)} className="mt-3 text-xs text-muted hover:text-text inline-flex items-center gap-1">
          {showRole ? <><EyeOff className="h-3.5 w-3.5" /> Masquer</> : <><Eye className="h-3.5 w-3.5" /> Afficher</>}
        </button>
        <p className="text-xs text-muted mt-4">La phase d'indices démarre dans un instant…</p>
      </div>
    );
  }

  /* ---------- CLUES : indices à tour de rôle ---------- */
  if (phase === 'clues') {
    const current = room.players.find(p => p.id === clueTurn?.currentId);
    return (
      <div className="space-y-4">
        <PhaseHeader title="Indices" left={left} sub={role?.role === 'imposter' ? '🤫 Tu es l\u2019imposteur — reste crédible' : `Mot : ${role?.word}`} />
        <div className="card rounded-2xl p-4">
          <p className="text-sm text-muted mb-3">Chacun donne <b className="text-text">un mot</b> lié au thème, à tour de rôle.</p>
          <div className="space-y-2">
            {clues.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm animate-slideUp">
                <span className="font-semibold">{c.name} :</span> <Tag color="brand">{c.clue || '—'}</Tag>
              </div>
            ))}
            {clues.length === 0 && <p className="text-xs text-muted">En attente du premier indice…</p>}
          </div>
        </div>
        {isMyClueTurn ? (
          <div className="flex gap-2">
            <input value={clueText} onChange={e => setClueText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendClue()} maxLength={40} autoFocus placeholder="Ton indice (un mot)…"
              className="flex-1 rounded-xl border border-brand bg-surface-2 px-4 py-3 text-sm outline-none" />
            <Button onClick={sendClue}><Send className="h-4 w-4" /></Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted">C'est au tour de <b className="text-text">{current?.name || '…'}</b> ({(clueTurn?.index ?? 0) + 1}/{clueTurn?.total})</p>
        )}
      </div>
    );
  }

  /* ---------- DISCUSSION ---------- */
  if (phase === 'discussion') {
    return (
      <div className="space-y-4">
        <PhaseHeader title="Discussion" left={left} sub="Débattez : qui semble louche ?" />
        <div className="card rounded-2xl p-4">
          <p className="text-sm text-muted mb-3">Récap des indices :</p>
          <div className="flex flex-wrap gap-2">
            {clues.map((c, i) => <Tag key={i} color="muted"><b className="mr-1">{c.name}</b> {c.clue}</Tag>)}
          </div>
        </div>
        {isHost && <Button onClick={() => socket.emit('game:skipVote')} className="w-full"><Vote className="h-4 w-4" /> Passer au vote</Button>}
      </div>
    );
  }

  /* ---------- VOTE ---------- */
  if (phase === 'vote') {
    return (
      <div className="space-y-4">
        <PhaseHeader title="Vote" left={left} sub="Qui est l'imposteur ?" />
        <div className="grid gap-2">
          {room.players.map(p => (
            <button key={p.id} disabled={!!vote || p.id === playerId} onClick={() => castVote(p.id)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${vote === p.id ? 'border-danger bg-danger/10' : 'border-border bg-surface-2 hover:border-danger/50'} disabled:opacity-60`}>
              <span className="flex items-center gap-2"><Avatar name={p.avatar} label={p.name} size={30} /> {p.name} {p.id === playerId && <span className="text-xs text-muted">(toi)</span>}</span>
              {p.hasVoted && <Tag color="success">a voté</Tag>}
            </button>
          ))}
        </div>
        {vote && <p className="text-center text-xs text-muted">Vote enregistré. En attente des autres…</p>}
      </div>
    );
  }

  /* ---------- RESULT ---------- */
  if (phase === 'result' && result) {
    const imposters = room.players.filter(p => result.imposterIds.includes(p.id));
    return (
      <div className="space-y-4">
        <div className={`text-center rounded-3xl p-6 border-2 ${result.crewWins ? 'border-success/50 bg-success/10' : 'border-danger/50 bg-danger/10'}`}>
          <div className="text-2xl font-display font-bold mb-1">{result.crewWins ? '🎉 L\u2019équipage gagne !' : '🕵️ L\u2019imposteur s\u2019en sort !'}</div>
          <p className="text-sm text-muted">Le mot secret était <b className="text-text">{result.secret?.word}</b></p>
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {imposters.map(p => <Tag key={p.id} color="danger"><Ghost className="h-3 w-3" /> {p.name}</Tag>)}
          </div>
        </div>
        <div className="card rounded-2xl p-4">
          <p className="text-sm font-semibold mb-2">Votes</p>
          <div className="space-y-1.5 text-sm">
            {Object.entries(result.votes).map(([voter, target]) => {
              const vp = room.players.find(p => p.id === voter); const tp = room.players.find(p => p.id === target);
              return <div key={voter} className="flex items-center gap-2 text-muted"><b className="text-text">{vp?.name}</b> <ArrowRight className="h-3 w-3" /> {tp?.name}</div>;
            })}
            {Object.keys(result.votes).length === 0 && <p className="text-xs text-muted">Aucun vote.</p>}
          </div>
        </div>
        {isHost ? (
          <div className="flex gap-2">
            {room.round < room.settings.rounds
              ? <Button onClick={() => socket.emit('game:next')} className="flex-1"><Play className="h-4 w-4" /> Manche suivante</Button>
              : <Button onClick={() => socket.emit('game:lobby')} className="flex-1"><DoorOpen className="h-4 w-4" /> Retour au salon</Button>}
          </div>
        ) : <p className="text-center text-xs text-muted">En attente de l'hôte…</p>}
      </div>
    );
  }

  return <Spinner className="mx-auto my-16" />;
}

function PhaseHeader({ title, sub, left }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-display font-bold text-lg">{title}</h3>
        <p className="text-xs text-muted">{sub}</p>
      </div>
      {left > 0 && <div className={`font-mono font-bold text-lg ${left <= 10 ? 'text-danger' : 'text-muted'}`}>{left}s</div>}
    </div>
  );
}
