import React, { useEffect, useState } from 'react';
import { Trophy, CalendarClock } from 'lucide-react';
import { api } from '../lib/api.js';
import { GAMES } from '../games/registry.js';
import { Card, Avatar, Tag, LoadingBlock, EmptyState, Progress } from '../components/ui/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const SOLO_GAMES = GAMES.filter(g => g.mode === 'solo');
const PERIODS = [{ id: 'all', label: 'Général' }, { id: 'week', label: 'Semaine' }, { id: 'day', label: 'Jour' }];

function timeLeft(endsAt) {
  const ms = endsAt - Date.now(); if (ms <= 0) return 'terminée';
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}j ${h}h` : `${h}h`;
}

export default function Leaderboards() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [game, setGame] = useState('xp');
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(null);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (game === 'season') {
      api('/api/season').then(d => { setSeason(d); setData({ rows: d.top }); }).catch(() => {}).finally(() => setLoading(false));
    } else {
      const p = game === 'xp' ? 'all' : period;
      api(`/api/leaderboard?game=${game}&period=${p}`).then(setData).catch(() => {}).finally(() => setLoading(false));
    }
  }, [game, period]);

  const rows = data?.rows || [];
  const unit = (game === 'xp' || game === 'season') ? 'XP' : 'pts';

  return (
    <div className="py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl inline-flex items-center gap-2"><Trophy className="h-7 w-7 text-warning" /> Classements</h1>
        <p className="text-muted mt-1">Les meilleurs joueurs, par jeu, par période et par saison.</p>
      </div>

      {/* Sélecteur */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <TabBtn active={game === 'xp'} onClick={() => setGame('xp')}>🌍 XP global</TabBtn>
        <TabBtn active={game === 'season'} onClick={() => setGame('season')}>🏆 Saison</TabBtn>
        {SOLO_GAMES.map(g => <TabBtn key={g.id} active={game === g.id} onClick={() => setGame(g.id)}>{g.name}</TabBtn>)}
      </div>

      {/* Bannière saison */}
      {game === 'season' && season && (
        <div className="relative overflow-hidden rounded-3xl p-6 gradient-border" style={{ background: 'linear-gradient(135deg, rgb(var(--brand)/0.18), rgb(var(--brand-2)/0.10))' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand mb-1"><CalendarClock className="h-4 w-4" /> Saison en cours</div>
              <h2 className="font-display font-bold text-2xl">{season.season.name}</h2>
              <p className="text-sm text-muted">Se termine dans {timeLeft(season.season.endsAt)}</p>
            </div>
            {user && season.me && (
              <div className="min-w-[12rem]">
                <div className="flex justify-between text-xs text-muted mb-1"><span>Niveau de saison {season.me.level}</span><span>{season.me.xp} XP</span></div>
                <Progress value={Math.round((season.me.into / season.me.need) * 100)} />
                {season.me.rank && <p className="text-xs text-muted mt-1">Ton rang : #{season.me.rank}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Période (jeux uniquement) */}
      {game !== 'xp' && game !== 'season' && (
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
                  <button onClick={() => nav(`/u/${r.userId}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left"><Avatar name={r.avatar} label={r.username} size={34} /><span className="font-semibold truncate hover:text-brand transition-colors">{r.username} {mine && <span className="text-xs text-brand">(toi)</span>}</span></button>
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
