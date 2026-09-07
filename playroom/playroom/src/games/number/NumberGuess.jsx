import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Check, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/index.jsx';
import { useSubmitScore } from '../../lib/hooks.js';
import { sound } from '../../lib/sound.js';

const MAX = 100;
const newTarget = () => 1 + Math.floor(Math.random() * MAX);

export default function NumberGuess() {
  const [target, setTarget] = useState(newTarget);
  const [value, setValue] = useState('');
  const [history, setHistory] = useState([]);
  const [done, setDone] = useState(false);
  const submit = useSubmitScore();

  const reset = () => { setTarget(newTarget()); setValue(''); setHistory([]); setDone(false); };

  const guess = async (e) => {
    e?.preventDefault?.();
    const n = parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1 || n > MAX) return;
    const hint = n === target ? 'ok' : n < target ? 'up' : 'down';
    const next = [...history, { n, hint }];
    setHistory(next); setValue('');
    if (hint === 'ok') {
      setDone(true); sound.play('win');
      const tries = next.length;
      // score : moins d'essais = mieux (max ~100)
      const score = Math.max(10, 110 - tries * 12);
      await submit('number', score, { won: tries <= 7, meta: { tries } });
    } else sound.play(hint === 'up' ? 'tick' : 'tick');
  };

  return (
    <div className="space-y-4">
      <div className="text-center card rounded-2xl py-6">
        <p className="text-sm text-muted">Je pense à un nombre entre <b className="text-text">1</b> et <b className="text-text">{MAX}</b></p>
        {done ? (
          <>
            <div className="text-5xl font-display font-bold gradient-text mt-2">{target}</div>
            <p className="text-sm text-muted mt-1">Trouvé en <b className="text-text">{history.length}</b> essai(s) !</p>
          </>
        ) : (
          <div className="text-5xl font-display font-bold text-muted/40 mt-2">?</div>
        )}
      </div>

      {!done ? (
        <form onSubmit={guess} className="flex gap-2">
          <input type="number" min="1" max={MAX} value={value} onChange={e => setValue(e.target.value)} placeholder="Ton nombre…" autoFocus
            className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />
          <Button type="submit" size="lg"><Check className="h-4 w-4" /> Valider</Button>
        </form>
      ) : (
        <Button variant="ghost" onClick={reset} className="w-full"><RotateCcw className="h-4 w-4" /> Nouvelle partie</Button>
      )}

      <div className="flex flex-wrap gap-2">
        {history.map((h, i) => (
          <span key={i} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-mono ${h.hint === 'ok' ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'}`}>
            {h.n}
            {h.hint === 'up' && <ArrowUp className="h-3.5 w-3.5 text-brand-2" />}
            {h.hint === 'down' && <ArrowDown className="h-3.5 w-3.5 text-danger" />}
            {h.hint === 'ok' && <Check className="h-3.5 w-3.5" />}
          </span>
        ))}
      </div>
      {!done && history.length > 0 && (
        <p className="text-center text-xs text-muted">{history[history.length - 1].hint === 'up' ? '⬆️ Plus haut !' : '⬇️ Plus bas !'}</p>
      )}
    </div>
  );
}
