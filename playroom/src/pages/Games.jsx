import React, { useMemo, useState } from 'react';
import { Search, X, Grid3x3, Star } from 'lucide-react';
import { GAMES, CATEGORIES, filterByCategory } from '../games/registry.js';
import GameCard from '../components/game/GameCard.jsx';
import { EmptyState } from '../components/ui/index.jsx';
import { useGameFavs } from '../context/GameFavsContext.jsx';

export default function Games() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Tous');
  const { favs, loggedIn } = useGameFavs();

  const list = useMemo(() => {
    let base = cat === 'Tous' ? GAMES : filterByCategory(cat);
    const query = q.trim().toLowerCase();
    if (query) base = base.filter(g => (g.name + ' ' + g.tagline + ' ' + g.category.join(' ')).toLowerCase().includes(query));
    return base;
  }, [q, cat]);

  const favGames = GAMES.filter(g => favs.has(g.id));

  return (
    <div className="py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl md:text-4xl mb-1">Tous les <span className="gradient-text">jeux</span></h1>
        <p className="text-muted">{GAMES.length} jeux à découvrir — solo, à plusieurs et en duel.</p>
      </div>

      {loggedIn && favGames.length > 0 && cat === 'Tous' && !q && (
        <section>
          <h2 className="font-display font-bold text-xl inline-flex items-center gap-2 mb-3"><Star className="h-5 w-5 text-warning fill-warning" /> Mes favoris</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favGames.map(g => <GameCard key={g.id} game={g} />)}
          </div>
        </section>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un jeu…"
          className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-9 py-3 text-sm outline-none focus:border-brand transition-colors" />
        {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"><X className="h-4 w-4" /></button>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <Chip active={cat === 'Tous'} onClick={() => setCat('Tous')}>Tous</Chip>
        {CATEGORIES.map(c => (
          <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>
            <span className="mr-1">{c.emoji}</span>{c.key}
          </Chip>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Search} title="Aucun jeu trouvé" hint="Essaie un autre mot-clé ou une autre catégorie." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {list.map((g, i) => <div key={g.id} style={{ '--i': i }}><GameCard game={g} /></div>)}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${active ? 'bg-brand text-white shadow-glow' : 'bg-surface-2 text-muted hover:text-text hover:bg-border'}`}>{children}</button>
  );
}
