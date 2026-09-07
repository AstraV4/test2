import React, { useCallback, useRef, useState } from 'react';
import { Grid3x3, Play, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/index.jsx';
import { PlayAgain, burstConfetti } from '../../components/PlayAgain.jsx';
import { useSubmitScore } from '../../lib/hooks.js';
import { sound } from '../../lib/sound.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Taille de grille et nombre de cases à mémoriser selon la manche.
function levelConfig(round) {
  const size = Math.min(6, 3 + Math.floor(round / 2)); // 3x3 -> 6x6
  const count = Math.min(size * size - 2, 3 + round);   // cases à retenir
  return { size, count };
}

export default function MemGrid() {
  const [state, setState] = useState('idle'); // idle | show | input | over
  const [round, setRound] = useState(0);
  const [size, setSize] = useState(3);
  const [target, setTarget] = useState(new Set());
  const [shown, setShown] = useState(new Set());
  const [picked, setPicked] = useState(new Set());
  const [wrong, setWrong] = useState(-1);
  const [best, setBest] = useState(0);
  const submit = useSubmitScore();

  const startRound = useCallback(async (r) => {
    const { size, count } = levelConfig(r);
    setSize(size); setRound(r); setPicked(new Set()); setWrong(-1);
    // choisir des cases uniques
    const cells = new Set();
    while (cells.size < count) cells.add(Math.floor(Math.random() * size * size));
    setTarget(cells);
    setState('show'); setShown(cells);
    sound.play('tick');
    await sleep(700 + count * 260);
    setShown(new Set()); setState('input');
  }, []);

  const begin = () => startRound(0);

  const click = async (i) => {
    if (state !== 'input' || picked.has(i)) return;
    if (target.has(i)) {
      const np = new Set(picked); np.add(i); setPicked(np);
      sound.play('ok');
      if (np.size === target.size) {
        // manche réussie
        await sleep(350);
        startRound(round + 1);
      }
    } else {
      setWrong(i); sound.play('lose'); setState('over');
      const score = round; // manches réussies
      setBest(b => Math.max(b, score));
      submit('memgrid', score, { won: score >= 6, meta: { rounds: score } });
      if (score >= 6) burstConfetti();
    }
  };

  const cellCls = (i) => {
    if (state === 'show' && shown.has(i)) return 'bg-brand shadow-[0_0_20px] shadow-brand/50';
    if (picked.has(i)) return 'bg-success';
    if (i === wrong) return 'bg-danger';
    if (state === 'over' && target.has(i)) return 'bg-brand/40';
    return 'bg-surface-2 hover:bg-border';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Manche <b className="text-text">{round + (state === 'idle' ? 0 : 1)}</b></span>
        <span className="text-muted">Record : <b className="text-brand">{best}</b></span>
      </div>

      <div className="relative">
        <div className="grid gap-2 mx-auto" style={{ gridTemplateColumns: `repeat(${size}, minmax(0,1fr))`, maxWidth: `${size * 68}px` }}>
          {Array.from({ length: size * size }).map((_, i) => (
            <button key={i} onClick={() => click(i)} disabled={state === 'show' || state === 'idle' || state === 'over'}
              className={`aspect-square rounded-xl transition-all duration-200 ${cellCls(i)}`} aria-label={`Case ${i + 1}`} />
          ))}
        </div>

        {(state === 'idle' || state === 'over') && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center card rounded-2xl px-6 py-5 shadow-card">
              {state === 'over' ? <>
                <div className="text-3xl font-display font-bold mb-1">{round}</div>
                <p className="text-sm text-muted mb-4">manches réussies</p>
                <Button onClick={begin}><RotateCcw className="h-4 w-4" /> Rejouer</Button>
              </> : <>
                <Grid3x3 className="h-8 w-8 mx-auto mb-2 text-brand" />
                <p className="text-sm text-muted mb-4 max-w-[12rem]">Mémorise les cases allumées, puis reproduis-les.</p>
                <Button onClick={begin}><Play className="h-4 w-4" /> Commencer</Button>
              </>}
            </div>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted h-4">{state === 'show' ? 'Mémorise…' : state === 'input' ? `Clique les ${target.size} cases` : ''}</p>
    </div>
  );
}
