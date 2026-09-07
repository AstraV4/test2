import React, { useCallback, useRef, useState } from 'react';
import { Brain, RotateCcw, Play } from 'lucide-react';
import { Button } from '../../components/ui/index.jsx';
import { useSubmitScore } from '../../lib/hooks.js';
import { sound } from '../../lib/sound.js';

const PADS = [
  { c: '#f43f5e', f: 300 }, { c: '#22d3ee', f: 400 },
  { c: '#34d399', f: 500 }, { c: '#facc15', f: 620 },
];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default function Memory() {
  const [seq, setSeq] = useState([]);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState('idle'); // idle | show | input | over
  const [round, setRound] = useState(0);
  const [best, setBest] = useState(0);
  const inputPos = useRef(0);
  const submit = useSubmitScore();
  const busy = state === 'show';

  const flash = useCallback(async (pad) => {
    setActive(pad); beep(pad); await sleep(320); setActive(-1); await sleep(140);
  }, []);

  const playSeq = useCallback(async (s) => {
    setState('show'); await sleep(500);
    for (const pad of s) await flash(pad);
    inputPos.current = 0; setState('input');
  }, [flash]);

  const start = async () => {
    const first = [Math.floor(Math.random() * 4)];
    setSeq(first); setRound(1); setState('show');
    await playSeq(first);
  };

  const press = async (pad) => {
    if (state !== 'input') return;
    beep(pad); setActive(pad); setTimeout(() => setActive(-1), 160);
    if (pad === seq[inputPos.current]) {
      inputPos.current++;
      if (inputPos.current === seq.length) {
        // manche réussie -> on allonge
        const next = [...seq, Math.floor(Math.random() * 4)];
        setSeq(next); setRound(r => r + 1);
        await sleep(450); await playSeq(next);
      }
    } else {
      sound.play('lose'); setState('over');
      const score = round - 1; // nombre de manches réussies
      setBest(b => Math.max(b, score));
      await submit('memory', Math.max(0, score), { won: score >= 8, meta: { rounds: score } });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted">Manche <span className="font-bold text-text">{Math.max(round, 0)}</span></div>
        <div className="text-sm text-muted">Record : <span className="font-bold text-brand">{best}</span></div>
      </div>

      <div className="relative mx-auto grid grid-cols-2 gap-3 max-w-xs aspect-square">
        {PADS.map((p, i) => (
          <button key={i} disabled={busy || state === 'idle' || state === 'over'} onClick={() => press(i)}
            className="rounded-2xl transition-all disabled:cursor-default"
            style={{ background: p.c, opacity: active === i ? 1 : 0.45, transform: active === i ? 'scale(0.97)' : 'scale(1)', boxShadow: active === i ? `0 0 40px ${p.c}` : 'none' }}
            aria-label={`Pad ${i + 1}`} />
        ))}
        {(state === 'idle' || state === 'over') && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center card rounded-2xl px-6 py-5 shadow-card">
              {state === 'over' ? <>
                <div className="text-3xl font-display font-bold mb-1">{round - 1}</div>
                <p className="text-sm text-muted mb-4">manches réussies</p>
                <Button onClick={start}><RotateCcw className="h-4 w-4" /> Rejouer</Button>
              </> : <>
                <Brain className="h-8 w-8 mx-auto mb-2 text-brand" />
                <p className="text-sm text-muted mb-4 max-w-[12rem]">Observe la séquence puis reproduis-la.</p>
                <Button onClick={start}><Play className="h-4 w-4" /> Commencer</Button>
              </>}
            </div>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted">{state === 'show' ? 'Observe bien…' : state === 'input' ? 'À toi de reproduire !' : ''}</p>
    </div>
  );
}

function beep(pad) { sound.play('tick'); }
