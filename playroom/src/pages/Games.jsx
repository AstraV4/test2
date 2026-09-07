import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { GAMES, CATEGORIES, filterByCategory } from '../games/registry.js';
import GameCard from '../components/game/GameCard.jsx';
import { EmptyState } from '../components/ui/index.jsx';

export default function Games() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Tous');

  const list = useMemo(() => {
    let base = cat === 'Tous' ? GAMES : filterByCategory(cat);
    const query = q.trim().toLowerCase();
    if (query) base = base.filter(g => (g.name + ' ' + g.tagline + ' ' + g.category.join(' ')).toLowerCase().includes(query));
    return base;
  }, [q, cat]);

  const cats = ['Tous', ...CATEGORIES];

  return (
    <div className="py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl mb-1">Tous les jeux</h1>
        <p className="text-muted">{GAMES.length} jeux à découvrir — solo et multijoueur.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un jeu…"
          className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-9 py-3 text-sm outline-none focus:border-brand" />
        {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"><X className="h-4 w-4" /></button>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${cat === c ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
            {c}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Search} title="Aucun jeu trouvé" hint="Essaie un autre mot-clé ou une autre catégorie." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(g => <GameCard key={g.id} game={g} />)}
        </div>
      )}
    </div>
  );
}
