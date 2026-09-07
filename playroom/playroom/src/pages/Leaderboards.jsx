import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { api } from '../lib/api.js';
import { GAMES } from '../games/registry.js';
import { Card, Avatar, Tag, LoadingBlock, EmptyState } from '../components/ui/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const SOLO_GAMES = GAMES.filter(g => g.mode === 'solo');
const PERIODS = [{ id: 'all', label: 'Général' }, { id: 'week', label: 'Semaine' }, { id: 'day', label: 'Jour' }];

export default function Leaderboards() {
  const { user } = useAuth();
  const [game, setGame] = useState('xp');
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = game === 'xp' ? 'all' : period;
    api(`/api/leaderboard?game=${game}&period=${p}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [game, period]);

  const rows = data?.rows || [];
  const unit = game === 'xp' ? 'XP' : 'pts';

  return (
    <div className="py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl inline-flex items-center gap-2"><Trophy className="h-7 w-7 text-warning" /> Classements</h1>
        <p className="text-muted mt-1">Les meilleurs joueurs, par jeu et par période.</p>
      </div>

      {/* Sélecteur de jeu */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <TabBtn active={game === 'xp'} onClick={() => setGame('xp')}>🌍 XP global</TabBtn>
        {SOLO_GAMES.map(g => <TabBtn key={g.id} active={game === g.id} onClick={() => setGame(g.id)}>{g.name}</TabBtn>)}
      </div>

      {/* Période (sauf XP global) */}
      {game !== 'xp' && (
        <div className="flex gap-2">
          {PERIODS.map(p => <TabBtn key={p.id} small active={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</TabBtn>)}
        </div>
      )}

      {loading ? <LoadingBlock /> : rows.length === 0 ? (
        <EmptyState icon={Trophy} title="Classement vide" hint="Personne n'a encore marqué de points ici. À toi de jouer !" />
      ) : (
        <>
          {/* Podium */}
          <div className="grid grid-cols-3 gap-3 items-end">
            {[1, 0, 2].map(pos => {
              const r = rows[pos]; if (!r) return <div key={pos} />;
              const heights = ['h-24', 'h-32', 'h-20']; const medal = ['🥈', '🥇', '🥉'];
              const order = pos === 0 ? 1 : pos === 1 ? 0 : 2;
              return (
                <div key={pos} className="flex flex-col items-center">
                  <Avatar name={r.avatar} label={r.username} size={pos === 0 ? 56 : 44} ring={pos === 0} />
                  <div className="text-sm font-semibold mt-2 truncate max-w-full">{r.username}</div>
                  <div className="text-xs text-muted">{r.score} {unit}</div>
                  <div className={`mt-2 w-full ${heights[order]} rounded-t-xl bg-gradient-to-t from-surface-2 to-brand/20 flex items-start justify-center pt-2 text-2xl`}>{medal[order]}</div>
                </div>
              );
            })}
          </div>

          {/* Reste du classement */}
          <Card className="divide-y divide-border">
            {rows.map((r, i) => {
              const mine = user && r.userId === user.id;
              return (
                <div key={r.userId} className={`flex items-center gap-3 px-5 py-3 ${mine ? 'bg-brand/10' : ''}`}>
                  <span className="w-6 text-center font-bold text-muted">{i < 3 ? ['🥇', '🥈', '🥉'][i] : r.rank}</span>
                  <Avatar name={r.avatar} label={r.username} size={34} />
                  <span className="font-semibold flex-1 truncate">{r.username} {mine && <span className="text-xs text-brand">(toi)</span>}</span>
                  <Tag color="brand">Nv.{r.level}</Tag>
                  <span className="font-mono text-sm text-muted w-20 text-right">{r.score} {unit}</span>
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children, small }) {
  return (
    <button onClick={onClick} className={`whitespace-nowrap rounded-full font-medium transition-colors ${small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${active ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{children}</button>
  );
}
