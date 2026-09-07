import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Play, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/index.jsx';
import { PlayAgain, burstConfetti } from '../../components/PlayAgain.jsx';
import { useSubmitScore } from '../../lib/hooks.js';
import { sound } from '../../lib/sound.js';

const TEXTS = [
  "Le vif renard brun saute par-dessus le chien paresseux.",
  "Jouer chaque jour rend les réflexes plus rapides et plus précis.",
  "Une bonne stratégie vaut mieux que mille clics au hasard.",
  "La patience et la vitesse forment un duo redoutable au clavier.",
  "Rejoins tes amis, crée un salon et lance la partie en un instant.",
  "Concentre-toi sur la précision, la vitesse viendra naturellement ensuite.",
];

export default function TypeRush() {
  const [state, setState] = useState('idle'); // idle | play | over
  const [text, setText] = useState('');
  const [typed, setTyped] = useState('');
  const [startAt, setStartAt] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const submit = useSubmitScore();

  const start = () => {
    setText(TEXTS[Math.floor(Math.random() * TEXTS.length)]);
    setTyped(''); setStartAt(null); setResult(null); setState('play');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const onChange = (v) => {
    if (state !== 'play') return;
    if (!startAt && v.length === 1) setStartAt(Date.now());
    if (v.length > text.length) v = v.slice(0, text.length);
    // petit son sur erreur de frappe
    if (v.length > typed.length && v[v.length - 1] !== text[v.length - 1]) sound.play('tick');
    setTyped(v);
    if (v.length === text.length) finish(v);
  };

  const finish = (final) => {
    const elapsedMin = Math.max(0.05, (Date.now() - startAt) / 60000);
    let correct = 0; for (let i = 0; i < text.length; i++) if (final[i] === text[i]) correct++;
    const accuracy = correct / text.length;
    const words = text.trim().split(/\s+/).length;
    const wpm = Math.round(words / elapsedMin);
    const score = Math.max(0, Math.round(wpm * accuracy));
    const r = { wpm, accuracy: Math.round(accuracy * 100), score, errors: text.length - correct };
    setResult(r); setState('over');
    if (score >= 40) { sound.play('win'); burstConfetti(); } else sound.play('ok');
    submit('typerush', score, { won: score >= 50, meta: r });
  };

  const chars = useMemo(() => text.split('').map((ch, i) => {
    let cls = 'text-muted';
    if (i < typed.length) cls = typed[i] === ch ? 'text-success' : 'text-danger bg-danger/10 rounded';
    else if (i === typed.length) cls = 'text-text bg-brand/20 rounded';
    return <span key={i} className={cls}>{ch}</span>;
  }), [text, typed]);

  if (state === 'idle') {
    return (
      <div className="text-center card rounded-2xl py-12">
        <Keyboard className="h-10 w-10 mx-auto mb-3 text-accent" />
        <h3 className="font-bold text-lg mb-1">Frappe Rapide</h3>
        <p className="text-sm text-muted mb-5 max-w-sm mx-auto">Recopie le texte le plus vite possible sans faire d'erreurs. Score = vitesse (WPM) × précision.</p>
        <Button size="lg" onClick={start}><Play className="h-4 w-4" /> Démarrer</Button>
      </div>
    );
  }

  if (state === 'over' && result) {
    return (
      <div className="text-center card rounded-2xl py-10">
        <div className="text-5xl font-display font-bold gradient-text">{result.wpm}</div>
        <p className="text-sm text-muted mt-1">mots / minute</p>
        <div className="flex justify-center gap-6 mt-4 text-sm">
          <div><div className="font-bold text-lg">{result.accuracy}%</div><div className="text-muted text-xs">précision</div></div>
          <div><div className="font-bold text-lg">{result.score}</div><div className="text-muted text-xs">score</div></div>
          <div><div className="font-bold text-lg">{result.errors}</div><div className="text-muted text-xs">erreurs</div></div>
        </div>
        <div className="mt-6"><PlayAgain onReplay={start} /></div>
      </div>
    );
  }

  const progress = Math.round((typed.length / text.length) * 100);
  return (
    <div className="space-y-4" onClick={() => inputRef.current?.focus()}>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-accent to-brand-2 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="card rounded-2xl p-6 text-lg leading-relaxed font-mono tracking-tight cursor-text select-none">
        {chars}
      </div>
      <input ref={inputRef} value={typed} onChange={e => onChange(e.target.value)} autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" placeholder="Commence à taper ici…" />
      <p className="text-center text-xs text-muted">Astuce : la régularité bat la précipitation.</p>
    </div>
  );
}
