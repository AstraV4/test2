import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Eraser, Trash2, Palette, Crown, Trophy, Clock } from 'lucide-react';
import { Avatar, Button, Tag, Spinner } from '../../components/ui/index.jsx';
import { useCountdown } from '../../lib/hooks.js';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

const COLORS = ['#e9edf5', '#f43f5e', '#fb923c', '#facc15', '#34d399', '#22d3ee', '#588cff', '#a855f7', '#111827'];
const SIZES = [3, 7, 14];

export default function DrawGuess({ socket, room, playerId, endsAt }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [color, setColor] = useState('#e9edf5');
  const [size, setSize] = useState(7);
  const [tool, setTool] = useState('pen');
  const [word, setWord] = useState(null);      // mot complet (si dessinateur)
  const [wordLen, setWordLen] = useState(0);
  const [choices, setChoices] = useState(null); // 3 mots proposés au dessinateur
  const [hint, setHint] = useState('');         // motif d'indices ("_ a _ _")
  const [reveal, setReveal] = useState(null);  // { word, scores }
  const [over, setOver] = useState(null);       // { podium }
  const left = useCountdown(endsAt);

  const me = room.players.find(p => p.id === playerId);
  const isDrawer = !!me?.isDrawer;
  const phase = room.phase;

  // Initialise le canvas (résolution interne fixe pour une synchro simple).
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    cv.width = 800; cv.height = 500;
    const ctx = cv.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = '#0f131c'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctxRef.current = ctx;
  }, []);

  // Écoute des événements de dessin/mot/reveal/podium.
  useEffect(() => {
    const drawSeg = (s) => {
      const ctx = ctxRef.current; if (!ctx) return;
      ctx.strokeStyle = s.color; ctx.lineWidth = s.size;
      ctx.beginPath(); ctx.moveTo(s.x0 * 800, s.y0 * 500); ctx.lineTo(s.x1 * 800, s.y1 * 500); ctx.stroke();
    };
    const clearCv = () => { const ctx = ctxRef.current; if (ctx) { ctx.fillStyle = '#0f131c'; ctx.fillRect(0, 0, 800, 500); } };
    const onWord = (d) => { setWord(d.word); setWordLen(d.length); setChoices(null); setReveal(null); setOver(null); setHint(''); clearCv(); if (d.isDrawer) sound.play('notify'); };
    const onChoices = (d) => { setChoices(d.words); setReveal(null); setOver(null); };
    const onHint = (d) => setHint(d.pattern || '');
    const onReveal = (d) => { setReveal(d); setChoices(null); sound.play('ok'); };
    const onCorrect = () => sound.play('ok');
    const onOver = (d) => { setOver(d); setReveal(null); setChoices(null); burstConfetti(); sound.play('win'); };
    const onToLobby = () => { setWord(null); setReveal(null); setOver(null); setChoices(null); setHint(''); clearCv(); };
    socket.on('draw:stroke', drawSeg);
    socket.on('draw:clear', clearCv);
    socket.on('draw:word', onWord);
    socket.on('draw:choices', onChoices);
    socket.on('draw:hint', onHint);
    socket.on('draw:reveal', onReveal);
    socket.on('draw:correct', onCorrect);
    socket.on('draw:over', onOver);
    socket.on('game:toLobby', onToLobby);
    socket.emit('game:sync'); // récupère mot/choix/indice courant (montage tardif + reconnexion)
    return () => {
      socket.off('draw:stroke', drawSeg); socket.off('draw:clear', clearCv); socket.off('draw:word', onWord);
      socket.off('draw:choices', onChoices); socket.off('draw:hint', onHint);
      socket.off('draw:reveal', onReveal); socket.off('draw:correct', onCorrect); socket.off('draw:over', onOver); socket.off('game:toLobby', onToLobby);
    };
  }, [socket]);

  // Coordonnées normalisées 0..1 à partir de l'événement pointeur.
  const pos = (e) => {
    const cv = canvasRef.current; const r = cv.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: Math.max(0, Math.min(1, cx / r.width)), y: Math.max(0, Math.min(1, cy / r.height)) };
  };
  const start = (e) => { if (!isDrawer || phase !== 'draw') return; drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current || !isDrawer || phase !== 'draw') return;
    e.preventDefault();
    const p = pos(e); const l = last.current; last.current = p;
    const col = tool === 'eraser' ? '#0f131c' : color;
    const seg = { x0: l.x, y0: l.y, x1: p.x, y1: p.y, color: col, size: tool === 'eraser' ? size * 2.4 : size };
    const ctx = ctxRef.current; ctx.strokeStyle = seg.color; ctx.lineWidth = seg.size;
    ctx.beginPath(); ctx.moveTo(seg.x0 * 800, seg.y0 * 500); ctx.lineTo(seg.x1 * 800, seg.y1 * 500); ctx.stroke();
    socket.emit('draw:stroke', seg);
  };
  const end = () => { drawing.current = false; last.current = null; };
  const clearAll = () => socket.emit('draw:clear');

  // Podium final
  if (over) {
    const podium = over.podium || [];
    return (
      <div className="space-y-4">
        <div className="text-center"><Trophy className="h-10 w-10 mx-auto text-warning mb-2" /><h3 className="font-display font-bold text-2xl">Fin de la partie !</h3></div>
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
        <div className="card rounded-2xl divide-y divide-border">
          {podium.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-5 text-center font-bold text-muted">{i + 1}</span>
              <Avatar name={r.avatar} label={r.name} size={28} />
              <span className="flex-1 truncate text-sm font-medium">{r.name}</span>
              <span className="font-mono text-sm text-muted">{r.score}</span>
            </div>
          ))}
        </div>
        {me?.isHost && <Button className="w-full" onClick={() => socket.emit('game:lobby')}>Retour au salon</Button>}
      </div>
    );
  }

  const maskedWord = Array.from({ length: wordLen }).map(() => '_').join(' ');

  // Phase de choix du mot
  if (phase === 'drawPick') {
    if (isDrawer && choices) {
      return (
        <div className="text-center py-8 animate-fadeIn">
          <Pencil className="h-9 w-9 mx-auto mb-3 text-brand" />
          <h3 className="font-display font-bold text-xl mb-1">Choisis ton mot à dessiner</h3>
          <p className="text-sm text-muted mb-6">Tu as 15 secondes pour choisir.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {choices.map((w, i) => (
              <button key={i} onClick={() => { socket.emit('draw:pick', { index: i }); setChoices(null); }}
                className="rounded-xl border border-border bg-surface-2 hover:border-brand hover:bg-brand/10 px-5 py-4 font-display font-bold text-lg transition-all">
                {w}
              </button>
            ))}
          </div>
        </div>
      );
    }
    const drawer = room.players.find(p => p.isDrawer);
    return (
      <div className="text-center py-16 animate-fadeIn">
        <div className="inline-flex items-center gap-2 text-muted"><Spinner /> {drawer?.name || 'Le dessinateur'} choisit un mot…</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Barre d'état */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          {isDrawer ? (
            <span>À toi de dessiner : <b className="text-brand text-lg font-display">{word}</b></span>
          ) : reveal ? (
            <span>Le mot était <b className="text-success">{reveal.word}</b></span>
          ) : (
            <span className="font-mono text-lg font-bold" style={{ letterSpacing: '0.35em' }}>{(hint || maskedWord).toUpperCase()}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {room.draw && <Tag color="muted">Tour {room.draw.turn}/{room.draw.totalTurns}</Tag>}
          {left > 0 && phase === 'draw' && <span className={`inline-flex items-center gap-1 font-mono font-bold ${left <= 10 ? 'text-danger' : 'text-muted'}`}><Clock className="h-4 w-4" /> {left}s</span>}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-2xl overflow-hidden border border-border" style={{ aspectRatio: '8 / 5' }}>
        <canvas ref={canvasRef} className="w-full h-full touch-none"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          style={{ cursor: isDrawer && phase === 'draw' ? 'crosshair' : 'default' }} />
        {reveal && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
            <div className="text-center">
              <div className="text-sm text-white/70">Le mot était</div>
              <div className="text-3xl font-display font-bold text-white">{reveal.word}</div>
              <div className="text-xs text-white/60 mt-2">Manche suivante dans un instant…</div>
            </div>
          </div>
        )}
      </div>

      {/* Outils (dessinateur uniquement) */}
      {isDrawer && phase === 'draw' && (
        <div className="flex items-center gap-3 flex-wrap card rounded-2xl p-3">
          <div className="flex gap-1.5">
            {COLORS.map(c => <button key={c} onClick={() => { setColor(c); setTool('pen'); }} className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c && tool === 'pen' ? 'border-brand scale-110' : 'border-transparent'}`} style={{ background: c }} aria-label={`Couleur ${c}`} />)}
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="flex gap-1.5 items-center">
            {SIZES.map(s => <button key={s} onClick={() => setSize(s)} className={`h-8 w-8 rounded-lg flex items-center justify-center ${size === s ? 'bg-brand text-white' : 'bg-surface-2'}`}><span className="rounded-full bg-current" style={{ width: s, height: s }} /></button>)}
          </div>
          <div className="h-6 w-px bg-border" />
          <button onClick={() => setTool('pen')} className={`h-8 px-3 rounded-lg inline-flex items-center gap-1 text-sm ${tool === 'pen' ? 'bg-brand text-white' : 'bg-surface-2'}`}><Pencil className="h-4 w-4" /></button>
          <button onClick={() => setTool('eraser')} className={`h-8 px-3 rounded-lg inline-flex items-center gap-1 text-sm ${tool === 'eraser' ? 'bg-brand text-white' : 'bg-surface-2'}`}><Eraser className="h-4 w-4" /></button>
          <button onClick={clearAll} className="h-8 px-3 rounded-lg inline-flex items-center gap-1 text-sm bg-surface-2 hover:text-danger ml-auto"><Trash2 className="h-4 w-4" /> Effacer</button>
        </div>
      )}
      {!isDrawer && phase === 'draw' && (
        <p className="text-center text-sm text-muted"><Palette className="h-4 w-4 inline mr-1" /> Devine le dessin en écrivant dans le chat !</p>
      )}

      {/* Scores en direct */}
      <div className="flex flex-wrap gap-2">
        {[...room.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map(p => (
          <div key={p.id} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${p.isDrawer ? 'bg-brand/15 text-brand' : p.hasGuessed ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'}`}>
            {p.isDrawer && <Pencil className="h-3 w-3" />}{p.hasGuessed && !p.isDrawer && '✅'}
            <span className="font-medium">{p.name}</span> <b>{p.score || 0}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
