import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, Gauge, Play } from 'lucide-react';
import { Card, Tag } from '../ui/index.jsx';

export default function GameCard({ game }) {
  const Icon = game.icon;
  const [a, b] = game.color;
  return (
    <Card hover className="group overflow-hidden flex flex-col">
      <Link to={`/jeux/${game.slug}`} className="block">
        <div className="relative h-28 overflow-hidden" style={{ background: `linear-gradient(135deg, ${a}22, ${b}22)` }}>
          <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(20rem 10rem at 20% 0%, ${a}, transparent 60%)` }} />
          <div className="absolute -right-3 -bottom-3 opacity-20 group-hover:opacity-30 transition-opacity">
            <Icon className="h-24 w-24" style={{ color: a }} strokeWidth={1.25} />
          </div>
          <div className="absolute top-3 left-3 flex gap-2">
            {game.isNew && <Tag color="accent">Nouveau</Tag>}
            <Tag color={game.mode === 'multi' ? 'warning' : 'brand'}>{game.mode === 'multi' ? 'Multijoueur' : 'Solo'}</Tag>
          </div>
          <div className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between">
          <Link to={`/jeux/${game.slug}`} className="font-display font-bold text-text hover:text-brand transition-colors">{game.name}</Link>
        </div>
        <p className="text-sm text-muted mt-1 line-clamp-2 flex-1">{game.tagline}</p>
        <div className="flex items-center gap-3 text-[11px] text-muted mt-3">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {game.players}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {game.duration}</span>
          <span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" /> {game.difficulty}</span>
        </div>
        <Link to={`/jeux/${game.slug}`} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-surface-2 hover:bg-brand hover:text-white text-sm font-semibold py-2.5 transition-colors">
          <Play className="h-4 w-4" /> Jouer
        </Link>
      </div>
    </Card>
  );
}
