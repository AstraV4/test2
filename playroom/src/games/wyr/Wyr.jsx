import React, { useEffect, useState } from 'react';
import { Scale, Send, Heart, Shuffle, Check, Flame } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import ShareCard from '../../components/ShareCard.jsx';
import { sound } from '../../lib/sound.js';

// « Tu préfères ? » à 2 : à tour de rôle, un joueur écrit un dilemme (et son choix secret),
// l'autre répond, puis on révèle si les goûts collent. Pas de points, juste l'affinité.
export default function Wyr({ socket, room, playerId }) {
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [prompt, setPrompt] = useState('Tu préfères…');
  const [myChoice, setMyChoice] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [over, setOver] = useState(null);
  const [streak, setStreak] = useState(null);
  const w = room.wyr;
  const me = room.players.find(p => p.id === playerId);
  const isHost = me?.isHost;

  useEffect(() => {
    const onReveal = (r) => { sound.play(r.match ? 'win' : 'tick'); if (r.match) burstConfetti(20); };
    const onOver = (o) => { setOver(o); burstConfetti(); sound.play('win'); };
    const onLobby = () => setOver(null);
    const onStreak = (st) => setStreak(st);
    socket.on('wyr:reveal', onReveal); socket.on('wyr:over', onOver); socket.on('game:toLobby', onLobby); socket.on('duo:streak', onStreak);
    return () => { socket.off('wyr:reveal', onReveal); socket.off('wyr:over', onOver); socket.off('game:toLobby', onLobby); socket.off('duo:streak', onStreak); };
  }, [socket]);
  useEffect(() => { setOptionA(''); setOptionB(''); setPrompt('Tu préfères…'); setMyChoice(0); setAnswered(false); }, [w?.round]);

  if (!w) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;

  const asker = room.players.find(p => p.id === w.askerId);
  const chooser = room.players.find(p => p.id === w.chooserId);
  const iAmAsker = w.askerId === playerId;
  const phase = room.phase;

  // Écran de fin
  if (phase === 'wyrOver' || over) {
    const res = over || room.wyrResult || { affinity: 0, matches: 0, total: 0 };
    const msg = res.affinity >= 80 ? 'Âmes sœurs ! 💞' : res.affinity >= 50 ? 'De belles affinités !' : res.affinity >= 25 ? 'Vous êtes différents… et c\u2019est bien !' : 'Les opposés s\u2019attirent 😄';
    return (
      <div className="py-4 space-y-4 max-w-lg mx-auto">
        <div className="text-center">
          <h3 className="font-display font-bold text-2xl">Affinité : {res.affinity}%</h3>
          <p className="text-muted">{msg}</p>
          {streak?.streak > 1 && <p className="text-sm text-warning font-semibold mt-1 inline-flex items-center gap-1"><Flame className="h-4 w-4" /> {streak.streak} jours de suite à jouer ensemble !</p>}
        </div>
        <ShareCard
          title="Nos goûts à deux"
          statLine={`${res.affinity}% d'affinité`}
          subtitle={`${res.matches} réponses en commun sur ${res.total}${streak?.streak > 1 ? ` · ${streak.streak} jours de suite 🔥` : ''}`}
          players={[{ name: me?.name, avatar: me?.avatar }, { name: (asker?.id === playerId ? chooser : asker)?.name, avatar: (asker?.id === playerId ? chooser : asker)?.avatar }]}
          accent="#7c5cff" emoji="💛"
        />
        {isHost && <div className="flex gap-2 justify-center"><Button onClick={() => socket.emit('game:next')}>Rejouer</Button><Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button></div>}
      </div>
    );
  }

  const useSuggestion = () => { if (w.suggestion) { setOptionA(w.suggestion[0]); setOptionB(w.suggestion[1]); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tag color="brand"><Scale className="h-3 w-3" /> Tu préfères ?</Tag>
        <span className="text-sm text-muted">Manche {w.round}/{w.total} · Affinité {w.total ? Math.round((w.matches / Math.max(1, w.round - (phase === 'wyrReveal' ? 0 : 1))) * 100) || 0 : 0}%</span>
      </div>

      {/* Phase écriture (celui qui pose) */}
      {phase === 'wyrWrite' && (
        iAmAsker ? (
          <div className="space-y-3">
            <p className="text-sm text-muted text-center">À toi de poser le dilemme à <b className="text-text">{chooser?.name}</b> — et choisis secrètement ta réponse.</p>
            <input value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={80} placeholder="Intro (ex : Tu préfères…)" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-brand" />
            <div className="grid sm:grid-cols-2 gap-2">
              <button type="button" onClick={() => setMyChoice(0)} className={`rounded-xl border-2 p-1 text-left ${myChoice === 0 ? 'border-brand' : 'border-border'}`}>
                <input value={optionA} onChange={e => setOptionA(e.target.value)} maxLength={40} placeholder="Option A" onClick={e => e.stopPropagation()} className="w-full bg-transparent px-3 py-2 text-sm outline-none" />
                {myChoice === 0 && <div className="text-[11px] text-brand px-3 pb-1 inline-flex items-center gap-1"><Check className="h-3 w-3" /> ton choix</div>}
              </button>
              <button type="button" onClick={() => setMyChoice(1)} className={`rounded-xl border-2 p-1 text-left ${myChoice === 1 ? 'border-brand' : 'border-border'}`}>
                <input value={optionB} onChange={e => setOptionB(e.target.value)} maxLength={40} placeholder="Option B" onClick={e => e.stopPropagation()} className="w-full bg-transparent px-3 py-2 text-sm outline-none" />
                {myChoice === 1 && <div className="text-[11px] text-brand px-3 pb-1 inline-flex items-center gap-1"><Check className="h-3 w-3" /> ton choix</div>}
              </button>
            </div>
            <div className="flex items-center justify-between">
              {w.suggestion && <button onClick={useSuggestion} className="text-xs text-muted hover:text-text inline-flex items-center gap-1"><Shuffle className="h-3.5 w-3.5" /> Idée : {w.suggestion[0]} / {w.suggestion[1]}</button>}
              <Button onClick={() => optionA.trim() && optionB.trim() && socket.emit('wyr:submit', { prompt, optionA, optionB, choice: myChoice })} disabled={!optionA.trim() || !optionB.trim()}><Send className="h-4 w-4" /> Envoyer</Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-muted"><Spinner className="mx-auto mb-2" /> {asker?.name} prépare un dilemme pour toi…</div>
        )
      )}

      {/* Phase réponse (celui qui choisit) */}
      {phase === 'wyrAnswer' && w.options && (
        <div className="space-y-3">
          <div className="card rounded-2xl p-5 text-center"><h3 className="font-display font-bold text-xl">{w.prompt}</h3></div>
          {iAmAsker ? (
            <p className="text-center text-sm text-muted">{chooser?.name} choisit sa réponse…</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {w.options.map((opt, i) => (
                <button key={i} disabled={answered} onClick={() => { setAnswered(true); socket.emit('wyr:answer', { choice: i }); }}
                  className={`rounded-2xl border-2 px-4 py-6 font-display font-bold text-lg transition-all ${answered ? 'opacity-60' : 'hover:-translate-y-0.5 hover:border-brand'} border-border bg-surface-2`}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Révélation */}
      {phase === 'wyrReveal' && w.reveal && (
        <div className="space-y-3 animate-popIn">
          <div className="card rounded-2xl p-5 text-center"><h3 className="font-display font-bold text-lg">{w.reveal.prompt}</h3></div>
          <div className="grid grid-cols-2 gap-3">
            {w.reveal.options.map((opt, i) => {
              const askerPicked = w.reveal.askerChoice === i;
              const chooserPicked = w.reveal.chooserChoice === i;
              return (
                <div key={i} className={`rounded-2xl border-2 p-4 text-center ${(askerPicked || chooserPicked) ? 'border-brand bg-brand/5' : 'border-border'}`}>
                  <div className="font-display font-bold text-lg mb-2">{opt}</div>
                  <div className="flex flex-col gap-1 text-xs">
                    {askerPicked && <span className="inline-flex items-center gap-1 justify-center text-brand"><Avatar name={asker?.avatar} label={asker?.name} size={18} /> {asker?.name}</span>}
                    {chooserPicked && <span className="inline-flex items-center gap-1 justify-center text-accent"><Avatar name={chooser?.avatar} label={chooser?.name} size={18} /> {chooser?.name}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-center font-semibold">{w.reveal.match ? '💞 Vous avez répondu pareil !' : '↔️ Goûts différents !'}</p>
        </div>
      )}
    </div>
  );
}
