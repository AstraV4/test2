import React, { useEffect, useRef, useState } from 'react';
import { Calculator, Play, Zap, Check } from 'lucide-react';
import { Button } from '../../components/ui/index.jsx';
import { PlayAgain, burstConfetti } from '../../components/PlayAgain.jsx';
import { useSubmitScore } from '../../lib/hooks.js';
import { sound } from '../../lib/sound.js';

const DURATION = 45;

function makeProblem(level) {
  const ops = level < 3 ? ['+', '-'] : ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b;
  if (op === '×') { a = 2 + Math.floor(Math.random() * (4 + level)); b = 2 + Math.floor(Math.random() * (4 + level)); }
  else { a = 5 + Math.floor(Math.random() * (10 + level * 6)); b = 1 + Math.floor(Math.random() * (10 + level * 5)); if (op === '-' && b > a) [a, b] = [b, a]; }
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  return { a, b, op, answer, text: `${a} ${op} ${b}` };
}

export default function MathRush() {
  const [state, setState] = useState('idle'); // idle | play | over
  const [prob, setProb] = useState(null);
  const [value, setValue] = useState('');
  const [solved, setSolved] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState(null);
  const timerRef = useRef(null);
  const submit = useSubmitScore();

  const start = () => {
    setSolved(0); setCombo(0); setScore(0); setLeft(DURATION); setValue(''); setState('play');
    setProb(makeProblem(0));
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setLeft(l => { if (l <= 1) { finish(); return 0; } return l - 1; }), 1000);
  };

  const finish = () => {
    clearInterval(timerRef.current);
    setState('over');
    setScore(sc => { setSolved(s => { submit('mathrush', sc, { won: sc >= 20, meta: { solved: s } }); return s; }); if (sc >= 20) { sound.play('win'); burstConfetti(); } return sc; });
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const onChange = (v) => {
    setValue(v);
    if (!prob) return;
    if (parseInt(v, 10) === prob.answer) {
      const mult = 1 + Math.floor(combo / 3); // combo tous les 3
      setScore(s => s + mult);
      setSolved(s => s + 1);
      setCombo(c => c + 1);
      setFlash('ok'); setTimeout(() => setFlash(null), 180);
      sound.play('ok');
      setValue(''); setProb(makeProblem(Math.min(6, Math.floor((solved + 1) / 4))));
    }
  };

  const mult = 1 + Math.floor(combo / 3);

  if (state === 'idle') {
    return (
      <div className="text-center card rounded-2xl py-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(20rem 12rem at 50% 0%, #38bdf8, transparent)' }} />
        <Calculator className="h-10 w-10 mx-auto mb-3 text-brand-2" />
        <h3 className="font-bold text-lg mb-1">Calcul Rapide</h3>
        <p className="text-sm text-muted mb-5 max-w-sm mx-auto">{DURATION}s pour résoudre un max d'opérations. Les bonnes réponses en série activent un <b className="text-text">combo</b> qui multiplie ton score.</p>
        <Button size="lg" onClick={start}><Play className="h-4 w-4" /> Démarrer</Button>
      </div>
    );
  }

  if (state === 'over') {
    return (
      <div className="text-center card rounded-2xl py-12">
        <div className="text-5xl font-display font-bold gradient-text">{score}</div>
        <p className="text-sm text-muted mt-1 mb-5">points · {solved} opérations résolues</p>
        <PlayAgain onReplay={start} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Score : <b className="text-text">{score}</b></span>
        {combo >= 2 && <span className="inline-flex items-center gap-1 text-warning font-bold animate-popIn"><Zap className="h-4 w-4" /> Combo ×{mult}</span>}
        <span className={`font-mono font-bold ${left <= 10 ? 'text-danger' : 'text-muted'}`}>{left}s</span>
      </div>
      <div className={`card rounded-2xl py-12 text-center transition-all ${flash === 'ok' ? 'border-success/60 scale-[1.01]' : ''}`}>
        <div className="text-5xl font-display font-bold tracking-wide">{prob?.text}</div>
      </div>
      <input value={value} onChange={e => onChange(e.target.value)} inputMode="numeric" autoFocus autoComplete="off" placeholder="Réponse…"
        className="w-full rounded-xl border border-border bg-surface-2 px-4 py-4 text-center text-xl font-bold outline-none focus:border-brand" />
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand to-brand-2 transition-all" style={{ width: `${(left / DURATION) * 100}%` }} />
      </div>
    </div>
  );
}
