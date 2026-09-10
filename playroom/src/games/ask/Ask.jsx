import React, { useEffect, useState } from 'react';
import { MessageCircleQuestion, Send, Shuffle, Sparkles } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

// Balance tout : chacun son tour pose une question libre, l'autre est obligé de répondre.
// Pas de points — juste pour mieux se connaître.
export default function Ask({ socket, room, playerId }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [over, setOver] = useState(null);
  const A = room.ask;
  const me = room.players.find(p => p.id === playerId);
  const opp = room.players.find(p => p.id !== playerId);
  const isHost = me?.isHost;

  useEffect(() => {
    const onAnswered = () => sound.play('ok');
    const onOver = (o) => { setOver(o); burstConfetti(20); sound.play('win'); };
    const onLobby = () => setOver(null);
    socket.on('ask:answered', onAnswered); socket.on('ask:over', onOver); socket.on('game:toLobby', onLobby);
    return () => { socket.off('ask:answered', onAnswered); socket.off('ask:over', onOver); socket.off('game:toLobby', onLobby); };
  }, [socket]);
  useEffect(() => { setQuestion(''); setAnswer(''); }, [A?.round]);

  if (!A) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;
  const phase = room.phase;
  const iAmAsker = A.askerId === playerId;
  const askerName = room.players.find(p => p.id === A.askerId)?.name;

  // Fin : récap de tous les échanges
  if (phase === 'askOver' || over) {
    const res = over || room.askResult || { history: [] };
    return (
      <div className="py-4 space-y-4">
        <div className="text-center">
          <Sparkles className="h-10 w-10 mx-auto text-brand mb-1" />
          <h3 className="font-display font-bold text-2xl">Vous vous connaissez un peu mieux !</h3>
          <p className="text-muted text-sm">{res.history.length} questions échangées 💛</p>
        </div>
        <div className="space-y-2 max-h-[46vh] overflow-y-auto">
          {res.history.map((h, i) => (
            <div key={i} className="card rounded-xl p-3">
              <div className="text-xs text-muted">{h.askerName} demande :</div>
              <div className="font-semibold text-sm">{h.question}</div>
              <div className="text-xs text-muted mt-1">{h.answerName || h.answererName} répond :</div>
              <div className="text-sm">« {h.answer} »</div>
            </div>
          ))}
        </div>
        {isHost && <div className="flex gap-2 justify-center"><Button onClick={() => socket.emit('game:next')}>Rejouer</Button><Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button></div>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tag color="brand"><MessageCircleQuestion className="h-3 w-3" /> Balance tout</Tag>
        <span className="text-sm text-muted">Question {A.round}/{A.total}</span>
      </div>

      {/* Le poseur écrit sa question */}
      {phase === 'askWrite' && (
        iAmAsker ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">Pose une question à <b className="text-text">{opp?.name}</b> — il/elle sera obligé(e) de répondre 😏</p>
            <div className="flex gap-2">
              <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && question.trim() && socket.emit('ask:question', { text: question })} maxLength={120} autoFocus placeholder="Ta question…"
                className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />
              <Button disabled={!question.trim()} onClick={() => socket.emit('ask:question', { text: question })}><Send className="h-4 w-4" /></Button>
            </div>
            <button onClick={() => setQuestion(A.suggestion)} className="text-xs text-muted hover:text-text inline-flex items-center gap-1"><Shuffle className="h-3.5 w-3.5" /> Idée : {A.suggestion}</button>
          </div>
        ) : (
          <div className="py-12 text-center text-muted"><Spinner className="mx-auto mb-2" /> {askerName} te prépare une question…</div>
        )
      )}

      {/* Le destinataire répond (obligé) */}
      {phase === 'askAnswer' && (
        <div className="space-y-3">
          <div className="card rounded-2xl p-5 text-center">
            <div className="text-xs text-muted mb-1">{askerName} te demande :</div>
            <h3 className="font-display font-bold text-lg">{A.question}</h3>
          </div>
          {iAmAsker ? (
            <p className="text-center text-sm text-muted">{opp?.name} rédige sa réponse… (pas le choix 😄)</p>
          ) : (
            <div className="flex gap-2">
              <input value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && answer.trim() && socket.emit('ask:answer', { text: answer })} maxLength={200} autoFocus placeholder="Ta réponse (obligatoire !)…"
                className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />
              <Button disabled={!answer.trim()} onClick={() => socket.emit('ask:answer', { text: answer })}><Send className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      )}

      {/* Révélation de la réponse */}
      {phase === 'askReveal' && A.history?.length > 0 && (() => {
        const last = A.history[A.history.length - 1];
        return (
          <div className="space-y-2 animate-popIn">
            <div className="card rounded-2xl p-5">
              <div className="text-xs text-muted">{last.askerName} demande :</div>
              <div className="font-semibold">{last.question}</div>
              <div className="mt-3 flex items-start gap-2">
                <Avatar name={opp && (last.answererName === opp.name) ? opp.avatar : me?.avatar} label={last.answererName} size={28} />
                <div><div className="text-xs text-muted">{last.answererName} répond :</div><div className="text-lg font-medium">« {last.answer} »</div></div>
              </div>
            </div>
            {isHost && <div className="text-center"><Button onClick={() => socket.emit('game:next')}>{A.round >= A.total ? 'Voir le récap' : 'À toi de poser'} →</Button></div>}
          </div>
        );
      })()}

      {/* Historique compact des échanges précédents */}
      {A.history?.length > 1 && phase !== 'askReveal' && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Voir les {A.history.length} échanges précédents</summary>
          <div className="mt-2 space-y-1">
            {A.history.map((h, i) => <div key={i} className="rounded-lg bg-surface-2 px-3 py-1.5"><b>{h.question}</b> — {h.answererName} : « {h.answer} »</div>)}
          </div>
        </details>
      )}
    </div>
  );
}
