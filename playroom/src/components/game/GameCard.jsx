import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, Gauge, Play, BarChart3, Star } from 'lucide-react';
import { Tag } from '../ui/index.jsx';
import { useGameFavs } from '../../context/GameFavsContext.jsx';

// Décor d'ambiance propre à chaque jeu (rendu léger en SVG/CSS).
function Ambiance({ ambiance, a, b }) {
  const common = 'absolute inset-0 overflow-hidden';
  if (ambiance === 'space') return (
    <div className={common}>
      {[...Array(14)].map((_, i) => <span key={i} className="absolute rounded-full bg-white animate-floaty" style={{ width: 2, height: 2, top: `${(i * 37) % 100}%`, left: `${(i * 53) % 100}%`, opacity: 0.5, animationDelay: `${i * 0.3}s` }} />)}
    </div>
  );
  if (ambiance === 'speed') return (
    <div className={common}>
      {[...Array(6)].map((_, i) => <span key={i} className="absolute h-0.5 rounded-full" style={{ width: `${30 + i * 8}%`, top: `${18 + i * 12}%`, left: 0, background: `linear-gradient(90deg, transparent, ${a})`, opacity: 0.5 }} />)}
    </div>
  );
  if (ambiance === 'word' || ambiance === 'type') return (
    <div className={`${common} font-display font-bold text-white/10 leading-none`}>
      <span className="absolute text-6xl" style={{ top: '10%', left: '6%' }}>Aa</span>
      <span className="absolute text-4xl" style={{ top: '52%', left: '58%' }}>{ambiance === 'type' ? '⌨' : 'Zz'}</span>
    </div>
  );
  if (ambiance === 'mystery') return (
    <div className={common}><div className="absolute inset-0" style={{ background: `radial-gradient(8rem 8rem at 70% 30%, ${a}44, transparent 70%)` }} /><span className="absolute text-5xl" style={{ top: '30%', left: '60%', opacity: 0.15 }}>👁️</span></div>
  );
  if (ambiance === 'grid') return (
    <div className={common}>
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `linear-gradient(${a}55 1px, transparent 1px), linear-gradient(90deg, ${a}55 1px, transparent 1px)`, backgroundSize: '22px 22px' }} />
    </div>
  );
  if (ambiance === 'number') return (
    <div className={`${common} font-mono font-bold text-white/10`}>
      {['7', '3', '×', '9', '+', '5'].map((n, i) => <span key={i} className="absolute text-3xl" style={{ top: `${(i * 29) % 80}%`, left: `${(i * 41) % 85}%` }}>{n}</span>)}
    </div>
  );
  return <div className={common}><div className="absolute inset-0" style={{ background: `radial-gradient(10rem 8rem at 30% 20%, ${a}33, transparent 70%)` }} /></div>;
}

export default function GameCard({ game }) {
  const Icon = game.icon;
  const [a, b] = game.color;
  const { has, toggle, loggedIn } = useGameFavs();
  const fav = has(game.id);
  return (
    <div className="card-glow rounded-2xl overflow-hidden flex flex-col h-full group">
      <Link to={`/jeux/${game.slug}`} className="block">
        <div className="relative h-32 overflow-hidden" style={{ background: `linear-gradient(135deg, ${a}26, ${b}1a)` }}>
          <Ambiance ambiance={game.ambiance} a={a} b={b} />
          <div className="absolute -right-3 -bottom-3 opacity-20 group-hover:opacity-30 group-hover:scale-110 transition-all duration-500">
            <Icon className="h-24 w-24" style={{ color: a }} strokeWidth={1.1} />
          </div>
          <div className="absolute top-3 left-3 flex gap-2">
            {game.isNew && <Tag color="accent">Nouveau</Tag>}
            <Tag color={game.mode === 'multi' ? 'warning' : 'brand'}>{game.mode === 'multi' ? 'Multi' : 'Solo'}</Tag>
          </div>
          {loggedIn && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(game.id); }} title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              className={`absolute top-2.5 right-2.5 h-8 w-8 rounded-full flex items-center justify-center backdrop-blur transition-all ${fav ? 'bg-warning/20 text-warning' : 'bg-black/20 text-white/70 hover:text-warning'}`}>
              <Star className={`h-4 w-4 ${fav ? 'fill-warning' : ''}`} />
            </button>
          )}
          <div className="absolute bottom-3 left-3 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg group-hover:scale-110 transition-transform" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link to={`/jeux/${game.slug}`} className="font-display font-bold text-text hover:text-brand transition-colors">{game.name}</Link>
          {game.avgScore != null && <span className="inline-flex items-center gap-1 text-[11px] text-muted"><BarChart3 className="h-3 w-3" /> {game.avgScore}</span>}
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
    </div>
  );
}

export function GameCardSkeleton() {
  return (
    <div className="card rounded-2xl overflow-hidden">
      <div className="skeleton h-32 rounded-none" />
      <div className="p-4 space-y-2">
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-2/3" />
        <div className="skeleton h-9 w-full mt-3" />
      </div>
    </div>
  );
}
