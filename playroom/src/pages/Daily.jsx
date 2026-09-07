import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Trophy, Play, Share2, CalendarDays } from 'lucide-react';
import { api } from '../lib/api.js';
import { gameById } from '../games/registry.js';
import { Card, Button, Avatar, Tag, EmptyState } from '../components/ui/index.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function Skeleton() {
  return (
    <div className="py-8 space-y-6">
      <div className="skeleton h-40 rounded-3xl" />
      <div className="skeleton h-8 w-40" />
      {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
    </div>
  );
}

export default function Daily() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const { user } = useAuth();

  useEffect(() => { api('/api/daily').then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);

  if (loading) return <Skeleton />;
  if (!data) return <div className="py-16"><EmptyState icon={CalendarDays} title="Défi indisponible" hint="Réessaie dans un instant." /></div>;

  const game = gameById(data.game);
  const rows = data.rows || [];
  const [a, b] = game?.color || ['#7c5cff', '#588cff'];
  const Icon = game?.icon || Flame;

  const share = async () => {
    const text = `PLAYROOM · Défi du jour : ${game?.name}\nViens battre le meilleur score !`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast.success('Copié !'); } } catch { /* annulé */ }
  };

  return (
    <div className="py-8 space-y-6">
      {/* Bannière du défi */}
      <div className="relative overflow-hidden rounded-3xl p-8 md:p-10 gradient-border" style={{ background: `linear-gradient(135deg, ${a}22, ${b}14)` }}>
        <div className="absolute -right-6 -bottom-8 opacity-20"><Icon className="h-48 w-48" style={{ color: a }} strokeWidth={1} /></div>
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-warning/15 text-warning px-3 py-1 text-xs font-semibold mb-4"><Flame className="h-3.5 w-3.5" /> Défi du jour</div>
          <h1 className="font-display font-bold text-3xl md:text-4xl mb-2">{game?.name}</h1>
          <p className="text-muted text-sm max-w-md mb-6">{game?.tagline} Tout le monde joue au même jeu aujourd'hui — tente le meilleur score et grimpe dans le classement du jour.</p>
          <div className="flex flex-wrap gap-3">
            <Button as={Link} to={`/jeux/${game?.slug}`} size="lg"><Play className="h-4 w-4" /> Relever le défi</Button>
            <Button variant="outline" size="lg" onClick={share}><Share2 className="h-4 w-4" /> Partager</Button>
          </div>
        </div>
      </div>

      {/* Classement du jour */}
      <div>
        <h2 className="font-display font-bold text-xl inline-flex items-center gap-2 mb-4"><Trophy className="h-5 w-5 text-warning" /> Classement du jour</h2>
        {rows.length === 0 ? (
          <EmptyState icon={Trophy} title="Personne n'a encore joué aujourd'hui" hint="Sois le premier à marquer et prends la tête !" action={<Button as={Link} to={`/jeux/${game?.slug}`}>Jouer maintenant</Button>} />
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {rows.map((r, i) => {
              const mine = user && r.userId === user.id;
              return (
                <div key={r.userId} className={`flex items-center gap-3 px-5 py-3 ${mine ? 'bg-brand/10' : ''}`}>
                  <span className="w-7 text-center font-bold text-muted">{i < 3 ? ['🥇', '🥈', '🥉'][i] : r.rank}</span>
                  <Avatar name={r.avatar} label={r.username} size={34} />
                  <span className="font-semibold flex-1 truncate">{r.username} {mine && <span className="text-xs text-brand">(toi)</span>}</span>
                  <Tag color="brand">Nv.{r.level}</Tag>
                  <span className="font-mono text-sm text-muted w-16 text-right">{r.score}</span>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
