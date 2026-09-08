import React, { useEffect, useState } from 'react';
import { Trophy, Swords, Zap, Hand } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

// Un seul composant pour les 5 duels : le rendu s'adapte à room.duel.game.
export default function Duel({ socket, room, playerId }) {
  const [over, setOver] = useState(null);
  const d = room.duel;
  const me = room.players.find(p => p.id === playerId);
  const isHost = me?.isHost;
  const opp = room.players.find(p => p.id !== playerId);

  useEffect(() => {
    const onOver = (o) => { setOver(o); if (o.winnerId === playerId) { burstConfetti(); sound.play('win'); } else sound.play('lose'); };
    const onGo = () => sound.play('tick');
    socket.on('duel:over', onOver); socket.on('duel:go', onGo);
    return () => { socket.off('duel:over', onOver); socket.off('duel:go', onGo); };
  }, [socket, playerId]);
  useEffect(() => { if (d && !d.matchOver) setOver(null); }, [d?.matchOver]);

  if (!d) return <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;

  const myScore = d.scores?.[playerId] ?? 0;
  const oppScore = opp ? (d.scores?.[opp.id] ?? 0) : 0;

  // Écran de fin de match
  if (d.matchOver || over) {
    const winnerId = over?.winnerId || d.winnerId;
    const iWon = winnerId === playerId;
    return (
      <div className="text-center py-6 space-y-4">
        <Trophy className={`h-12 w-12 mx-auto ${iWon ? 'text-warning' : 'text-muted'}`} />
        <h3 className="font-display font-bold text-2xl">{iWon ? 'Victoire ! 🎉' : `${room.players.find(p => p.id === winnerId)?.name || 'L\u2019adversaire'} gagne`}</h3>
        {over?.forfeit && <p className="text-sm text-muted">Adversaire déconnecté.</p>}
        <div className="flex items-center justify-center gap-6">
          <ScorePill name={me?.name} avatar={me?.avatar} score={myScore} me />
          <span className="text-2xl font-bold text-muted">—</span>
          <ScorePill name={opp?.name} avatar={opp?.avatar} score={oppScore} />
        </div>
        {isHost ? (
          <div className="flex gap-2 justify-center">
            <Button onClick={() => socket.emit('game:next')}>Revanche</Button>
            <Button variant="outline" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button>
          </div>
        ) : <p className="text-sm text-muted">En attente de l'hôte…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score en tête */}
      <div className="flex items-center justify-center gap-4">
        <ScorePill name={me?.name} avatar={me?.avatar} score={myScore} me active={d.turn === playerId} />
        <div className="text-center"><div className="text-[10px] text-muted uppercase tracking-wide">1er à {d.target}</div><Swords className="h-4 w-4 mx-auto text-muted" /></div>
        <ScorePill name={opp?.name} avatar={opp?.avatar} score={oppScore} active={opp && d.turn === opp.id} />
      </div>

      {d.game === 'morpion' && <Morpion d={d} me={playerId} socket={socket} />}
      {d.game === 'connect4' && <Connect4 d={d} me={playerId} socket={socket} />}
      {d.game === 'rps' && <Rps d={d} me={playerId} opp={opp} socket={socket} />}
      {d.game === 'reflexduel' && <Reflex d={d} me={playerId} socket={socket} />}
      {d.game === 'mathduel' && <MathDuel d={d} me={playerId} socket={socket} />}
      {d.game === 'quizduel' && <QuizDuel d={d} me={playerId} socket={socket} />}
      {d.game === 'typerace' && <TypeRace d={d} me={playerId} socket={socket} />}
      {d.game === 'nim' && <Nim d={d} me={playerId} socket={socket} />}
      {d.game === 'memoduel' && <MemoDuel d={d} me={playerId} socket={socket} />}
      {d.game === 'dots' && <Dots d={d} me={playerId} socket={socket} />}

      {/* Bandeau de résultat de manche */}
      {d.roundOver && !d.matchOver && (
        <p className="text-center text-sm font-semibold animate-popIn">
          {d.roundWinner === 'draw' ? 'Manche nulle !' : d.roundWinner === playerId ? 'Manche gagnée ! ✅' : 'Manche perdue.'}
          <span className="text-muted font-normal"> · manche suivante…</span>
        </p>
      )}
    </div>
  );
}

function ScorePill({ name, avatar, score, me, active }) {
  return (
    <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 border ${active ? 'border-brand bg-brand/10' : 'border-border bg-surface-2'}`}>
      <Avatar name={avatar} label={name} size={30} ring={me} />
      <div className="text-left"><div className="text-xs font-semibold max-w-[6rem] truncate">{name}{me && ' (toi)'}</div><div className="text-lg font-display font-bold leading-none">{score}</div></div>
    </div>
  );
}

/* ---------- Morpion ---------- */
function Morpion({ d, me, socket }) {
  const myTurn = d.turn === me;
  const mySym = d.symbols?.[me];
  return (
    <div>
      <p className="text-center text-sm text-muted mb-3">{d.roundOver ? '' : myTurn ? `À toi de jouer (${mySym})` : "À l'adversaire…"}</p>
      <div className="grid grid-cols-3 gap-2 max-w-[15rem] mx-auto">
        {d.board.map((c, i) => (
          <button key={i} disabled={!myTurn || !!c || d.roundOver} onClick={() => socket.emit('duel:cell', { cell: i })}
            className={`aspect-square rounded-xl text-3xl font-display font-bold flex items-center justify-center transition-all ${c ? 'bg-surface-2' : 'bg-surface-2/50 hover:bg-surface-2'} ${c === 'X' ? 'text-brand' : c === 'O' ? 'text-accent' : ''}`}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Puissance 4 ---------- */
function Connect4({ d, me, socket }) {
  const myTurn = d.turn === me;
  const color = (v) => v === 'R' ? '#f43f5e' : v === 'J' ? '#facc15' : 'transparent';
  const myColor = d.symbols?.[me];
  return (
    <div>
      <p className="text-center text-sm text-muted mb-2">{d.roundOver ? '' : myTurn ? `À toi (${myColor === 'R' ? '🔴' : '🟡'})` : "À l'adversaire…"}</p>
      <div className="mx-auto max-w-[20rem] rounded-2xl bg-brand-2/20 p-2">
        {/* boutons colonnes */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {[...Array(7)].map((_, c) => (
            <button key={c} disabled={!myTurn || d.board[c] || d.roundOver} onClick={() => socket.emit('duel:col', { col: c })}
              className="text-xs text-muted hover:text-brand disabled:opacity-30 py-0.5">▼</button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {d.board.map((v, i) => (
            <div key={i} className="aspect-square rounded-full bg-bg/60 flex items-center justify-center">
              <div className="h-[85%] w-[85%] rounded-full transition-all" style={{ background: v ? color(v) : 'rgb(var(--surface))' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Pierre-Feuille-Ciseaux ---------- */
const RPS = { pierre: '✊', feuille: '✋', ciseaux: '✌️' };
function Rps({ d, me, opp, socket }) {
  const iChose = d.chosenIds?.includes(me);
  const reveal = d.reveal;
  return (
    <div className="text-center">
      {reveal ? (
        <div className="flex items-center justify-center gap-8 py-4 animate-popIn">
          <div><div className="text-5xl">{RPS[reveal.choices[me]]}</div><div className="text-xs text-muted mt-1">toi</div></div>
          <span className="text-2xl font-bold text-muted">VS</span>
          <div><div className="text-5xl">{RPS[reveal.choices[opp?.id]]}</div><div className="text-xs text-muted mt-1">{opp?.name}</div></div>
        </div>
      ) : iChose ? (
        <p className="py-8 text-muted">Choix enregistré. En attente de l'adversaire…</p>
      ) : (
        <div className="flex justify-center gap-3 py-4">
          {Object.entries(RPS).map(([k, e]) => (
            <button key={k} onClick={() => socket.emit('duel:rps', { choice: k })}
              className="h-20 w-20 rounded-2xl bg-surface-2 hover:bg-brand/15 hover:border-brand border border-border text-4xl transition-all hover:-translate-y-1">{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Duel de Réflexe ---------- */
function Reflex({ d, me, socket }) {
  const go = d.state === 'go';
  return (
    <button onClick={() => socket.emit('duel:tap')} disabled={d.roundOver}
      className={`w-full min-h-[12rem] rounded-3xl flex flex-col items-center justify-center gap-2 text-white transition-colors select-none active:scale-[0.99] ${go ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gradient-to-br from-rose-600/80 to-red-700/80'}`}>
      <Zap className="h-8 w-8 opacity-80" />
      <div className="text-3xl font-display font-bold">{go ? 'TAPE !' : 'Attends…'}</div>
      <div className="text-white/80 text-sm">{go ? 'Le plus rapide gagne la manche' : 'Ne tape pas avant le vert (faux départ = manche perdue)'}</div>
      {d.lastRt != null && d.roundOver && <div className="text-white/90 text-xs">Temps : {d.lastRt} ms</div>}
    </button>
  );
}

/* ---------- Duel de Calcul ---------- */
function MathDuel({ d, me, socket }) {
  const [val, setVal] = useState('');
  useEffect(() => { setVal(''); }, [d.problem?.text, d.round]);
  const submit = (e) => { e?.preventDefault?.(); if (val.trim() === '') return; socket.emit('duel:answer', { value: val }); setVal(''); };
  return (
    <div className="space-y-3">
      <div className="card rounded-2xl py-8 text-center"><div className="text-5xl font-display font-bold tracking-wide">{d.problem?.text}</div></div>
      <form onSubmit={submit}>
        <input value={val} onChange={e => setVal(e.target.value)} inputMode="numeric" autoFocus disabled={d.roundOver}
          placeholder="Ta réponse (le plus rapide marque)…" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-center text-xl font-bold outline-none focus:border-brand" />
      </form>
    </div>
  );
}

/* ---------- Quiz Duel ---------- */
function QuizDuel({ d, me, socket }) {
  const [picked, setPicked] = useState(null);
  useEffect(() => { setPicked(null); }, [d.quiz?.q, d.round]);
  if (!d.quiz) return <Spinner className="mx-auto my-10" />;
  return (
    <div className="space-y-3">
      <div className="card rounded-2xl p-5 text-center">
        <Tag color="muted" className="mb-2">{d.quiz.cat}</Tag>
        <h3 className="text-lg font-semibold">{d.quiz.q}</h3>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {d.quiz.options.map((opt, i) => (
          <button key={i} disabled={d.roundOver} onClick={() => { setPicked(i); socket.emit('duel:quiz', { choice: i }); }}
            className={`text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all ${picked === i ? 'border-brand bg-brand/10' : 'border-border bg-surface-2 hover:border-brand/50'}`}>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-surface text-xs font-bold mr-2">{String.fromCharCode(65 + i)}</span>{opt}
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted">Le premier à trouver la bonne réponse marque.</p>
    </div>
  );
}

/* ---------- Course de frappe ---------- */
function TypeRace({ d, me, socket }) {
  const [val, setVal] = useState('');
  useEffect(() => { setVal(''); }, [d.text, d.round]);
  const chars = (d.text || '').split('').map((ch, i) => {
    let cls = 'text-muted';
    if (i < val.length) cls = val[i] === ch ? 'text-success' : 'text-danger bg-danger/10 rounded';
    else if (i === val.length) cls = 'text-text bg-brand/20 rounded';
    return <span key={i} className={cls}>{ch}</span>;
  });
  const onChange = (v) => { setVal(v); if (v.trim() === (d.text || '').trim()) socket.emit('duel:type', { text: v }); };
  return (
    <div className="space-y-3">
      <div className="card rounded-2xl p-5 text-lg leading-relaxed font-mono">{chars}</div>
      <input value={val} onChange={e => onChange(e.target.value)} autoFocus disabled={d.roundOver} autoComplete="off" autoCorrect="off" spellCheck={false}
        placeholder="Recopie le texte le plus vite possible…" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />
    </div>
  );
}

/* ---------- Bâtonnets (Nim) ---------- */
function Nim({ d, me, socket }) {
  const myTurn = d.turn === me;
  return (
    <div className="text-center space-y-4">
      <div className="flex flex-wrap gap-1.5 justify-center max-w-sm mx-auto min-h-[4rem] items-center">
        {[...Array(d.sticks || 0)].map((_, i) => <div key={i} className="w-2 h-10 rounded-full bg-gradient-to-b from-brand to-brand-2" />)}
      </div>
      <p className="text-sm text-muted">{d.roundOver ? '' : myTurn ? 'À toi : retire 1, 2 ou 3 bâtonnets. Celui qui prend le dernier perd !' : "À l'adversaire…"}</p>
      <div className="flex gap-2 justify-center">
        {[1, 2, 3].map(n => (
          <Button key={n} disabled={!myTurn || d.roundOver || n > d.sticks} onClick={() => socket.emit('duel:take', { n })}>Retirer {n}</Button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Duel de Mémoire (paires) ---------- */
function MemoDuel({ d, me, socket }) {
  const memo = d.memo; if (!memo) return <Spinner className="mx-auto my-10" />;
  const myTurn = d.turn === me;
  return (
    <div>
      <p className="text-center text-sm text-muted mb-3">{myTurn ? 'À toi : retourne 2 cartes' : "À l'adversaire…"}</p>
      <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
        {[...Array(16)].map((_, i) => {
          const val = memo.faceUp?.[i];
          const face = val != null;
          const matched = memo.matched?.[i];
          return (
            <button key={i} disabled={!myTurn || face} onClick={() => socket.emit('duel:flip', { index: i })}
              className={`aspect-square rounded-xl flex items-center justify-center text-2xl font-display font-bold transition-all ${face ? (matched ? 'bg-success/20 text-success' : 'bg-brand/20 text-brand') : 'bg-surface-2 hover:bg-border text-transparent'}`}>
              {face ? EMOJI[val] : '?'}
            </button>
          );
        })}
      </div>
      <div className="flex justify-center gap-6 mt-3 text-sm">
        <span>Toi : <b>{memo.pairs?.[me] || 0}</b> paires</span>
      </div>
    </div>
  );
}
const EMOJI = { 1: '🍎', 2: '⭐', 3: '🚀', 4: '🎵', 5: '🐱', 6: '🌈', 7: '⚡', 8: '🍕' };

/* ---------- Petits Carrés (dots & boxes) ---------- */
function Dots({ d, me, socket }) {
  const dots = d.dots; if (!dots) return <Spinner className="mx-auto my-10" />;
  const { rows: R, cols: C, h, v, owners } = dots;
  const myTurn = d.turn === me;
  const cell = 56; // px
  const W = C * cell, H = R * cell;
  const colorOf = (id) => id === me ? 'rgb(var(--brand))' : 'rgb(var(--accent))';
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-muted">{myTurn ? 'À toi : trace une ligne (compléter un carré rejoue)' : "À l'adversaire…"}</p>
      <svg width={W + 20} height={H + 20} viewBox={`-10 -10 ${W + 20} ${H + 20}`} className="touch-none">
        {/* cases possédées */}
        {owners.map((o, bi) => { const r = Math.floor(bi / C), c = bi % C; return o ? <rect key={'b' + bi} x={c * cell + 4} y={r * cell + 4} width={cell - 8} height={cell - 8} rx="6" fill={colorOf(o)} opacity="0.25" /> : null; })}
        {/* arêtes horizontales */}
        {h.map((on, idx) => { const r = Math.floor(idx / C), c = idx % C; const x = c * cell, y = r * cell; return (
          <line key={'h' + idx} x1={x} y1={y} x2={x + cell} y2={y} stroke={on ? 'rgb(var(--brand))' : 'rgb(var(--border))'} strokeWidth={on ? 5 : 3} strokeLinecap="round"
            style={{ cursor: myTurn && !on ? 'pointer' : 'default' }} onClick={() => myTurn && !on && socket.emit('duel:edge', { type: 'h', index: idx })} />
        ); })}
        {/* arêtes verticales */}
        {v.map((on, idx) => { const r = Math.floor(idx / (C + 1)), c = idx % (C + 1); const x = c * cell, y = r * cell; return (
          <line key={'v' + idx} x1={x} y1={y} x2={x} y2={y + cell} stroke={on ? 'rgb(var(--brand))' : 'rgb(var(--border))'} strokeWidth={on ? 5 : 3} strokeLinecap="round"
            style={{ cursor: myTurn && !on ? 'pointer' : 'default' }} onClick={() => myTurn && !on && socket.emit('duel:edge', { type: 'v', index: idx })} />
        ); })}
        {/* points */}
        {[...Array((R + 1) * (C + 1))].map((_, i) => { const r = Math.floor(i / (C + 1)), c = i % (C + 1); return <circle key={'d' + i} cx={c * cell} cy={r * cell} r="4" fill="rgb(var(--text))" />; })}
      </svg>
      <div className="flex gap-4 text-sm"><span>Toi : <b>{dots.counts?.[me] || 0}</b> carré(s)</span></div>
    </div>
  );
}
