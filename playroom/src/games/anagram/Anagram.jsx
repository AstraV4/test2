import React, { useEffect, useRef, useState } from 'react';
import { Shuffle, Check, SkipForward, Play } from 'lucide-react';
import { Button, Spinner } from '../../components/ui/index.jsx';
import { api } from '../../lib/api.js';
import { useSubmitScore } from '../../lib/hooks.js';
import { sound } from '../../lib/sound.js';

const DURATION = 60; // secondes

export default function Anagram() {
  const [state, setState] = useState('idle'); // idle | play | over
  const [round, setRound] = useState(null);
  const [value, setValue] = useState('');
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [feedback, setFeedback] = useState(null); // 'ok' | 'bad'
  const timerRef = useRef(null);
  const submit = useSubmitScore();

  const loadWord = async () => {
    setValue(''); setFeedback(null);
    try { const r = await api('/api/anagram/word'); setRound(r); } catch { /* ignore */ }
  };

  const start = async () => {
    setScore(0); setLeft(DURATION); setState('play'); await loadWord();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setLeft(l => { if (l <= 1) { finish(); return 0; } return l - 1; }), 1000);
  };

  const finish = async () => {
    clearInterval(timerRef.current); setState('over');
    setScore(s => { submit('anagram', s, { won: s >= 6, meta: { solved: s } }); return s; });
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const check = async (e) => {
    e?.preventDefault?.();
    if (!round || !value.trim()) return;
    try {
      const r = await api('/api/anagram/check', { method: 'POST', body: { token: round.token, answer: value } });
      if (r.correct) { setScore(s => s + 1); setFeedback('ok'); sound.play('ok'); await loadWord(); }
      else { setFeedback('bad'); sound.play('error'); setTimeout(() => setFeedback(null), 500); }
    } catch { /* ignore */ }
  };

  if (state === 'idle') {
    return (
      <div className="text-center card rounded-2xl py-12">
        <Shuffle className="h-9 w-9 mx-auto mb-3 text-brand" />
        <h3 className="font-bold mb-1">Reconstitue un maximum de mots</h3>
        <p className="text-sm text-muted mb-5 max-w-sm mx-auto">Tu as {DURATION} secondes. Chaque bonne réponse enchaîne un nouveau mot.</p>
        <Button size="lg" onClick={start}><Play className="h-4 w-4" /> Démarrer</Button>
      </div>
    );
  }

  if (state === 'over') {
    return (
      <div className="text-center card rounded-2xl py-12">
        <div className="text-5xl font-display font-bold gradient-text">{score}</div>
        <p className="text-sm text-muted mt-1 mb-5">mots trouvés</p>
        <Button size="lg" onClick={start}><Play className="h-4 w-4" /> Rejouer</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">Score : <b className="text-text">{score}</b></span>
        <span className={`font-mono text-sm font-bold ${left <= 10 ? 'text-danger' : 'text-muted'}`}>{left}s</span>
      </div>
      <div className={`card rounded-2xl py-10 text-center transition-colors ${feedback === 'ok' ? 'border-success/50' : feedback === 'bad' ? 'border-danger/50' : ''}`}>
        {round ? (
          <div className="flex justify-center gap-2 flex-wrap px-4">
            {round.scrambled.toUpperCase().split('').map((ch, i) => (
              <span key={i} className="inline-flex h-11 w-9 items-center justify-center rounded-lg bg-surface-2 font-display font-bold text-xl">{ch}</span>
            ))}
          </div>
        ) : <Spinner className="mx-auto" />}
      </div>
      <form onSubmit={check} className="flex gap-2">
        <input value={value} onChange={e => setValue(e.target.value)} placeholder="Le mot d\u2019origine…" autoFocus autoComplete="off"
          className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />
        <Button type="submit"><Check className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" onClick={loadWord} title="Passer"><SkipForward className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
