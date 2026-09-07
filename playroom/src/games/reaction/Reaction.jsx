import React, { useEffect, useRef, useState } from 'react';
import { Zap, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/index.jsx';
import { useSubmitScore } from '../../lib/hooks.js';
import { sound } from '../../lib/sound.js';

const ROUNDS = 5;
// score = plus c'est rapide, plus c'est haut. 1000 - ms (borné), moyenné.
const toScore = (ms) => Math.max(0, Math.round(1000 - ms));

export default function Reaction() {
  const [state, setState] = useState('idle'); // idle | waiting | now | tooearly | done
  const [times, setTimes] = useState([]);
  const [last, setLast] = useState(null);
  const startRef = useRef(0);
  const timeoutRef = useRef(null);
  const submit = useSubmitScore();
  const round = times.length;

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const arm = () => {
    setState('waiting'); setLast(null);
    const delay = 1200 + Math.random() * 2600;
    timeoutRef.current = setTimeout(() => { startRef.current = performance.now(); setState('now'); sound.play('tick'); }, delay);
  };

  const begin = () => { setTimes([]); arm(); };

  const click = async () => {
    if (state === 'waiting') { clearTimeout(timeoutRef.current); setState('tooearly'); sound.play('error'); return; }
    if (state === 'now') {
      const ms = Math.round(performance.now() - startRef.current);
      const next = [...times, ms]; setLast(ms); setTimes(next);
      sound.play('ok');
      if (next.length >= ROUNDS) {
        setState('done');
        const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
        await submit('reaction', toScore(avg), { won: avg < 350, meta: { avg, times: next } });
      } else { setTimeout(arm, 550); }
    }
  };

  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

  const surfaces = {
    idle: { bg: 'from-surface-2 to-surface', label: 'Prêt ?', sub: 'Clique pour démarrer, puis attends le vert.' },
    waiting: { bg: 'from-rose-600/80 to-red-700/80', label: 'Attends…', sub: 'Ne clique pas tout de suite.' },
    now: { bg: 'from-emerald-500 to-teal-500', label: 'CLIQUE !', sub: 'Maintenant, le plus vite possible.' },
    tooearly: { bg: 'from-amber-500/80 to-orange-600/80', label: 'Trop tôt !', sub: 'Tu as cliqué avant le vert.' },
    done: { bg: 'from-brand/70 to-brand-2/70', label: `${avg} ms`, sub: 'Temps de réaction moyen.' },
  };
  const s = surfaces[state];

  return (
    <div className="space-y-4">
      <button
        onClick={state === 'idle' ? begin : state === 'tooearly' ? arm : state === 'done' ? begin : click}
        className={`w-full min-h-[16rem] rounded-3xl bg-gradient-to-br ${s.bg} text-white flex flex-col items-center justify-center gap-2 transition-colors select-none active:scale-[0.995]`}>
        <Zap className="h-8 w-8 opacity-80" />
        <div className="text-4xl font-display font-bold">{s.label}</div>
        <div className="text-white/80 text-sm">{s.sub}</div>
        {last != null && state === 'now' === false && state !== 'done' && <div className="text-white/90 text-xs mt-1">Dernier : {last} ms</div>}
      </button>

      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {Array.from({ length: ROUNDS }).map((_, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < round ? 'bg-brand' : 'bg-surface-2'}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 justify-end text-xs text-muted">
          {times.map((t, i) => <span key={i} className="rounded-lg bg-surface-2 px-2 py-1 font-mono">{t}ms</span>)}
        </div>
      </div>

      {state === 'done' && (
        <Button variant="ghost" onClick={begin} className="w-full"><RotateCcw className="h-4 w-4" /> Rejouer</Button>
      )}
    </div>
  );
}
