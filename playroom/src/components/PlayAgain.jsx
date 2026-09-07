import React from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, Grid3x3, Share2 } from 'lucide-react';
import { Button } from './ui/index.jsx';

// Confettis premium et sobres : quelques particules qui tombent, puis auto-nettoyage.
export function burstConfetti(count = 40) {
  if (typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#7c5cff', '#588cff', '#22dcc8', '#facc15', '#f43f5e'];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'confetti';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[i % colors.length];
    el.style.animationDuration = 2 + Math.random() * 1.5 + 's';
    el.style.animationDelay = Math.random() * 0.3 + 's';
    el.style.transform = `rotate(${Math.random() * 360}deg)`;
    frag.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
  document.body.appendChild(frag);
}

// Panneau "Encore une ?" affiché en fin de partie — principe "one more game".
export function PlayAgain({ onReplay, score, label = 'points', title = 'Bien joué !' }) {
  return (
    <div className="text-center animate-popIn">
      <h3 className="font-display font-bold text-xl mb-1">🔥 Encore une ?</h3>
      <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
        <Button onClick={onReplay}><RotateCcw className="h-4 w-4" /> Rejouer</Button>
        <Button as={Link} to="/jeux" variant="outline"><Grid3x3 className="h-4 w-4" /> Changer de jeu</Button>
      </div>
    </div>
  );
}
