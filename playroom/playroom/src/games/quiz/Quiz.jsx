import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, Play, Check, X, Flame } from 'lucide-react';
import { Button, Spinner, Progress, Tag } from '../../components/ui/index.jsx';
import { api } from '../../lib/api.js';
import { useSubmitScore } from '../../lib/hooks.js';
import { sound } from '../../lib/sound.js';

const PER_Q = 12; // secondes par question

export default function Quiz() {
  const [state, setState] = useState('idle'); // idle | play | over
  const [data, setData] = useState(null); // { token, questions }
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState([]);
  const [picked, setPicked] = useState(null);
  const [reveal, setReveal] = useState(null); // {correct, ok}
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [left, setLeft] = useState(PER_Q);
  const [result, setResult] = useState(null);
  const timerRef = useRef(null);
  const submit = useSubmitScore();

  const start = async () => {
    try {
      const d = await api('/api/quiz/round'); setData(d);
      setI(0); setPicks([]); setPicked(null); setReveal(null); setStreak(0); setBestStreak(0); setState('play');
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (state !== 'play' || picked !== null) return;
    setLeft(PER_Q);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setLeft(l => { if (l <= 1) { answer(-1); return 0; } return l - 1; }), 1000);
    return () => clearInterval(timerRef.current);
  }, [state, i, picked]);

  const answer = async (choice) => {
    if (picked !== null) return;
    clearInterval(timerRef.current);
    setPicked(choice);
    const nextPicks = [...picks]; nextPicks[i] = choice; setPicks(nextPicks);
    // On révèle localement en re-vérifiant à la fin côté serveur (source de vérité).
    // Ici, feedback immédiat via check à la fin ; pour l'affichage on marque juste "choisi".
    sound.play('click');
    setTimeout(() => next(nextPicks), 850);
  };

  const next = async (nextPicks) => {
    setPicked(null); setReveal(null);
    if (i + 1 >= data.questions.length) { await finish(nextPicks); return; }
    setI(i + 1);
  };

  const finish = async (finalPicks) => {
    clearInterval(timerRef.current);
    try {
      const r = await api('/api/quiz/check', { method: 'POST', body: { token: data.token, picks: finalPicks } });
      // recalcul de la série max à partir du détail
      let cur = 0, best = 0;
      r.detail.forEach(d => { if (d.ok) { cur++; best = Math.max(best, cur); } else cur = 0; });
      setBestStreak(best);
      setResult(r); setState('over');
      const score = r.correct + best; // bonnes réponses + bonus série
      score >= 5 ? sound.play('win') : sound.play('lose');
      await submit('quiz', score, { won: r.correct >= 7, meta: { correct: r.correct, total: r.total, bestStreak: best } });
    } catch { setState('over'); }
  };

  if (state === 'idle') {
    return (
      <div className="text-center card rounded-2xl py-12">
        <HelpCircle className="h-9 w-9 mx-auto mb-3 text-brand" />
        <h3 className="font-bold mb-1">10 questions, un chrono</h3>
        <p className="text-sm text-muted mb-5 max-w-sm mx-auto">{PER_Q}s par question. Enchaîne les bonnes réponses pour une meilleure série.</p>
        <Button size="lg" onClick={start}><Play className="h-4 w-4" /> Commencer</Button>
      </div>
    );
  }

  if (state === 'over' && result) {
    return (
      <div className="text-center card rounded-2xl py-10">
        <div className="text-5xl font-display font-bold gradient-text">{result.correct}/{result.total}</div>
        <p className="text-sm text-muted mt-1">bonnes réponses</p>
        <div className="inline-flex items-center gap-1 mt-3 text-sm text-warning font-semibold"><Flame className="h-4 w-4" /> Meilleure série : {bestStreak}</div>
        <div className="mt-6"><Button size="lg" onClick={start}><Play className="h-4 w-4" /> Rejouer</Button></div>
      </div>
    );
  }

  if (!data) return <Spinner className="mx-auto my-20" />;
  const q = data.questions[i];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Question <b className="text-text">{i + 1}</b>/{data.questions.length}</span>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-warning font-semibold"><Flame className="h-4 w-4" /> {streak}</span>
          <span className={`font-mono font-bold ${left <= 4 ? 'text-danger' : 'text-muted'}`}>{left}s</span>
        </div>
      </div>
      <Progress value={((i) / data.questions.length) * 100} />
      <div className="card rounded-2xl p-5">
        <Tag color="muted" className="mb-3">{q.cat}</Tag>
        <h3 className="text-lg font-semibold mb-4">{q.q}</h3>
        <div className="grid gap-2">
          {q.a.map((opt, idx) => {
            const chosen = picked === idx;
            return (
              <button key={idx} disabled={picked !== null} onClick={() => answer(idx)}
                className={`text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all ${chosen ? 'border-brand bg-brand/10' : 'border-border bg-surface-2 hover:border-brand/50'} disabled:cursor-default`}>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-surface text-xs font-bold mr-2">{String.fromCharCode(65 + idx)}</span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
