import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Trophy, Gamepad2, Target, Award, Lock } from 'lucide-react';
import { api, AVATARS } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, Avatar, Button, Progress, Tag, LoadingBlock, EmptyState } from '../components/ui/index.jsx';
import { ACH_LABELS } from '../lib/hooks.js';
import { gameById } from '../games/registry.js';

const ALL_ACH = Object.keys(ACH_LABELS);

export default function Profile() {
  const { user, logout, setAvatar, openAuth } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api('/api/me/profile').then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  if (!user) return (
    <div className="py-16"><EmptyState icon={Lock} title="Connecte-toi pour voir ton profil" hint="Ton XP, tes niveaux, tes records et tes succès t'attendent." action={<Button onClick={() => openAuth('login')}>Se connecter</Button>} /></div>
  );
  if (loading) return <LoadingBlock />;

  const lv = user.levelInfo || { level: user.level, into: 0, need: 100 };
  const pct = Math.round((lv.into / lv.need) * 100);
  const stats = data?.stats || { played: 0, wins: 0, perGame: [] };
  const winrate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const owned = new Set(data?.achievements || []);

  return (
    <div className="py-8 space-y-6">
      {/* En-tête profil */}
      <Card className="p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar name={user.avatar} label={user.username} size={72} ring />
          <div className="flex-1 min-w-[12rem]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-bold text-2xl">{user.username}</h1>
              <Tag color="brand">Niveau {lv.level}</Tag>
            </div>
            <p className="text-sm text-muted mt-0.5">{user.xp} XP au total</p>
            <div className="mt-3 max-w-sm">
              <div className="flex justify-between text-xs text-muted mb-1"><span>Niveau {lv.level}</span><span>{lv.into}/{lv.need} XP</span></div>
              <Progress value={pct} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout}><LogOut className="h-4 w-4" /> Déconnexion</Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Gamepad2} label="Parties jouées" value={stats.played} />
        <Stat icon={Trophy} label="Victoires" value={stats.wins} />
        <Stat icon={Target} label="Taux de victoire" value={`${winrate}%`} />
        <Stat icon={Award} label="Succès" value={`${owned.size}/${ALL_ACH.length}`} />
      </div>

      {/* Choix d'avatar */}
      <Card className="p-5">
        <h2 className="font-semibold mb-3">Avatar</h2>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map(av => (
            <button key={av} onClick={() => setAvatar(av)} className={`rounded-full transition-transform ${user.avatar === av ? 'ring-2 ring-brand scale-110' : 'opacity-70 hover:opacity-100'}`}>
              <Avatar name={av} label={user.username} size={40} />
            </button>
          ))}
        </div>
      </Card>

      {/* Records par jeu */}
      <Card className="p-5">
        <h2 className="font-semibold mb-3">Tes records</h2>
        {stats.perGame.length === 0 ? (
          <p className="text-sm text-muted">Aucune partie pour l'instant. <Link to="/jeux" className="text-brand hover:underline">Va jouer !</Link></p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {stats.perGame.map(pg => {
              const g = gameById(pg.game);
              return (
                <div key={pg.game} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
                  {g && <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: `linear-gradient(135deg, ${g.color[0]}, ${g.color[1]})` }}><g.icon className="h-4 w-4" /></div>}
                  <div className="flex-1"><div className="text-sm font-semibold">{g?.name || pg.game}</div><div className="text-xs text-muted">{pg.played} partie(s)</div></div>
                  <div className="text-right"><div className="font-mono font-bold">{pg.best}</div><div className="text-xs text-muted">record</div></div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Succès */}
      <Card className="p-5">
        <h2 className="font-semibold mb-3">Succès</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_ACH.map(code => {
            const has = owned.has(code);
            return (
              <div key={code} className={`rounded-xl px-3 py-3 text-sm border ${has ? 'border-brand/40 bg-brand/5' : 'border-border bg-surface-2 opacity-60'}`}>
                <div className={has ? '' : 'grayscale'}>{ACH_LABELS[code]}</div>
                {!has && <div className="text-[10px] text-muted mt-1 inline-flex items-center gap-1"><Lock className="h-3 w-3" /> à débloquer</div>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <Card className="p-4">
      <Icon className="h-5 w-5 text-brand mb-2" />
      <div className="text-2xl font-display font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Card>
  );
}
