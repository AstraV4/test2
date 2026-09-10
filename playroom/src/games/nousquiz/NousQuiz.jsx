import React, { useEffect, useState } from 'react';
import { HeartHandshake, Send, Plus, Check, X, Trophy } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

export default function NousQuiz({ socket, room, playerId }) {
  const [question, setQuestion] = useState('');
  const [opts, setOpts] = useState(['', '', '']);
  const [correct, setCorrect] = useState(0);
  const [over, setOver] = useState(null);
  const N = room.nq;
  const me = room.players.find(p => p.id === playerId);
  const opp = room.players.find(p => p.id !== playerId);
  const isHost = me?.isHost;

  useEffect(() => {
    const onReveal = (r) => sound.play(r.ok ? 'win' : 'error');
    const onOver = (o) => { setOver(o); burstConfetti(); sound.play('win'); };
    const onLobby = () => setOver(null);
    socket.on('nousquiz:reveal', onReveal); socket.on('nousquiz:over', onOver); socket.on('game:toLobby', onLobby);
    return () => { socket.off('nousquiz:reveal', onReveal); socket.off('nousquiz:over', onOver); socket.off('game:toLobby', onLobby); };
  }, [socket]);
  useEffect(() => { if (N) { setQuestion(N.prompt || ''); setOpts(['', '', '']); setCorrect(0); } }, [N?.round]);

  if (!N) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;
  const phase = room.phase;
  const iAmAsker = N.askerId === playerId;

  if (phase === 'nqOver' || over) {
    const res = over || room.nqResult;
    return (
      <div className="text-center py-6 space-y-4">
        <div className="relative inline-block"><HeartHandshake className="h-14 w-14 text-rose-400" /></div>
        <h3 className="font-display font-bold text-2xl">Vous vous connaissez à {res.affinity}%</h3>
        <div className="flex items-center justify-center gap-6"><Sc name={me?.name} avatar={me?.avatar} v={res.scores[playerId]} me /><span className="text-xl text-muted">—</span><Sc name={opp?.name} avatar={opp?.avatar} v={res.scores[opp?.id]} /></div>
        <p className="text-sm text-muted">(bonnes réponses = à quel point vous vous connaissez)</p>
        {isHost && <div className="flex gap-2 justify-center"><Button onClick={() => socket.emit('game:next')}>Rejouer</Button><Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button></div>}
      </div>
    );
  }

  // Écriture par celui qui pose (à propos de LUI-MÊME)
  if (phase === 'nqWrite') {
    if (!iAmAsker) return <div className="py-12 text-center text-muted"><Spinner className="mx-auto mb-2" /> {room.players.find(p => p.id === N.askerId)?.name} prépare une question sur lui/elle…</div>;
    const setOpt = (i, v) => setOpts(o => o.map((x, k) => k === i ? v : x));
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Pose une question <b className="text-text">sur toi</b>. {opp?.name} devra deviner la bonne réponse ! (Coche la vraie.)</p>
        <input value={question} onChange={e => setQuestion(e.target.value)} maxLength={80} placeholder="Ta question" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-brand" />
        {opts.map((v, i) => (
          <button key={i} type="button" onClick={() => setCorrect(i)} className={`w-full flex items-center gap-2 rounded-xl border-2 p-1.5 text-left ${correct === i ? 'border-success' : 'border-border'}`}>
            <input value={v} onChange={e => setOpt(i, e.target.value)} onClick={e => e.stopPropagation()} maxLength={40} placeholder={`Réponse ${i + 1}`} className="flex-1 bg-transparent px-3 py-2 text-sm outline-none" />
            <span className={`text-[11px] px-2 ${correct === i ? 'text-success' : 'text-muted'}`}>{correct === i ? '✓ vraie' : ''}</span>
          </button>
        ))}
        {opts.length < 4 && <button onClick={() => setOpts(o => [...o, ''])} className="text-xs text-muted hover:text-text inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> ajouter une réponse</button>}
        <Button className="w-full" disabled={opts.filter(o => o.trim()).length < 2} onClick={() => socket.emit('nousquiz:write', { question, options: opts, correct })}><Send className="h-4 w-4" /> Envoyer</Button>
      </div>
    );
  }

  // Devinette / révélation
  const reveal = phase === 'nqReveal' && N.reveal;
  return (
    <div className="space-y-3">
      <div className="card rounded-2xl p-5 text-center"><Tag color="muted" className="mb-2">à propos de {room.players.find(p => p.id === N.askerId)?.name}</Tag><h3 className="text-lg font-semibold">{N.question}</h3></div>
      {iAmAsker && !reveal ? <p className="text-center text-sm text-muted">{opp?.name} réfléchit…</p> : (
        <div className="grid gap-2">
          {(N.options || []).map((opt, i) => {
            const isCorrect = reveal && N.reveal.correct === i;
            const picked = reveal && N.reveal.guess === i;
            return (
              <button key={i} disabled={iAmAsker || reveal} onClick={() => socket.emit('nousquiz:guess', { index: i })}
                className={`text-left rounded-xl border-2 px-4 py-3 text-sm transition-all ${isCorrect ? 'border-success bg-success/10' : picked ? 'border-danger' : 'border-border bg-surface-2'} ${!iAmAsker && !reveal ? 'hover:border-brand/50' : ''}`}>
                {opt} {isCorrect && <Check className="h-4 w-4 inline text-success ml-1" />} {reveal && picked && !isCorrect && <X className="h-4 w-4 inline text-danger ml-1" />}
              </button>
            );
          })}
        </div>
      )}
      {reveal && <p className="text-center font-semibold">{N.reveal.ok ? '💞 Bien vu, vous vous connaissez !' : 'Presque ! Tu apprendras 😊'}</p>}
      {reveal && isHost && <div className="text-center"><Button onClick={() => socket.emit('game:next')}>{N.round >= N.total ? 'Résultat' : 'À l\u2019autre de poser'} →</Button></div>}
      <div className="flex justify-center gap-6 text-sm"><span>{me?.name} : <b>{N.scores[playerId]}</b></span><span>{opp?.name} : <b>{N.scores[opp?.id]}</b></span></div>
    </div>
  );
}
function Sc({ name, avatar, v, me }) { return <div className="text-center"><Avatar name={avatar} label={name} size={44} ring={me} /><div className="text-sm font-semibold mt-1">{name}</div><div className="text-2xl font-display font-bold">{v}</div></div>; }
