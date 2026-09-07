import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Trophy, Share2, RotateCcw } from 'lucide-react';
import { Button, Spinner } from '../../components/ui/index.jsx';
import { api } from '../../lib/api.js';
import { useSubmitScore } from '../../lib/hooks.js';
import { useToast } from '../../context/ToastContext.jsx';
import { burstConfetti } from '../../components/PlayAgain.jsx';
import { sound } from '../../lib/sound.js';

// Couleur de la jauge selon la proximité.
function heat(score) {
  if (score >= 90) return '#34d399';
  if (score >= 65) return '#22d3be';
  if (score >= 40) return '#facc15';
  if (score >= 20) return '#fb923c';
  return '#f43f5e';
}

export default function Semantic() {
  const [today, setToday] = useState(null);
  const [value, setValue] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [best, setBest] = useState(0);
  const [won, setWon] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);
  const submit = useSubmitScore();
  const toast = useToast();

  useEffect(() => { api('/api/semantic/today').then(setToday).catch(() => {}); }, []);

  const send = async (e) => {
    e?.preventDefault?.();
    const g = value.trim().toLowerCase();
    if (!g || busy || won) return;
    if (guesses.some(x => x.guess === g)) { toast.info('Déjà proposé.'); return; }
    setBusy(true);
    try {
      const r = await api('/api/semantic/guess', { method: 'POST', body: { guess: g, index: today?.index } });
      const entry = { guess: r.guess, score: r.score, win: r.win, rank: r.rank, id: Math.random() };
      setGuesses(prev => [entry, ...prev].sort((a, b) => b.score - a.score));
      setBest(b => Math.max(b, r.score));
      setValue('');
      if (r.win) {
        setWon(true); sound.play('win'); burstConfetti();
        if (!submitted.current) { submitted.current = true; await submit('semantic', 100, { won: true, meta: { tries: guesses.length + 1 } }); }
      } else sound.play(r.score >= 60 ? 'ok' : 'tick');
    } catch { toast.error('Erreur, réessaie.'); } finally { setBusy(false); }
  };

  const share = async () => {
    const text = `PLAYROOM · Proximo\nMot trouvé en ${guesses.length} essais, meilleure proximité ${best}/100 !`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast.success('Résultat copié !'); } }
    catch { /* annulé */ }
  };

  if (!today) return <Spinner className="mx-auto my-20" />;

  return (
    <div className="space-y-4">
      <div className="card rounded-2xl p-5 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand mb-1"><Sparkles className="h-4 w-4" /> Mot du jour</div>
        <p className="text-sm text-muted">Propose des mots : plus le <b className="text-text">sens</b> est proche du mot secret, plus le score grimpe (0 → 100).</p>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div><div className="text-2xl font-display font-bold text-text">{guesses.length}</div><div className="text-xs text-muted">essais</div></div>
          <div><div className="text-2xl font-display font-bold" style={{ color: heat(best) }}>{best}</div><div className="text-xs text-muted">meilleure proximité</div></div>
        </div>
      </div>

      {won ? (
        <div className="card rounded-2xl p-6 text-center border-success/40">
          <Trophy className="h-9 w-9 mx-auto mb-2 text-success" />
          <h3 className="font-display font-bold text-xl">Trouvé ! 🎉</h3>
          <p className="text-sm text-muted mt-1">En {guesses.length} essai(s).</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button variant="ghost" onClick={share}><Share2 className="h-4 w-4" /> Partager</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={send} className="flex gap-2">
          <input value={value} onChange={e => setValue(e.target.value)} placeholder="Un mot…" autoFocus autoComplete="off"
            className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />
          <Button type="submit" size="lg" loading={busy}><Send className="h-4 w-4" /></Button>
        </form>
      )}

      <div className="space-y-1.5">
        {guesses.length === 0 && <p className="text-center text-xs text-muted py-6">Tes propositions apparaîtront ici, classées par proximité.</p>}
        {guesses.map((g, idx) => (
          <div key={g.id} className={`relative overflow-hidden rounded-xl border border-border ${idx === 0 && !won ? 'ring-1 ring-brand/40' : ''}`}>
            <div className="absolute inset-y-0 left-0 opacity-25" style={{ width: `${g.score}%`, background: heat(g.score) }} />
            <div className="relative flex items-center justify-between px-4 py-2.5">
              <span className="font-medium">{g.guess} {g.win && '👑'}</span>
              <span className="font-mono font-bold text-sm" style={{ color: heat(g.score) }}>{g.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
