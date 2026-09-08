import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Trophy, Gamepad2, Target, Award, Lock, Pencil, Check, X } from 'lucide-react';
import { api, AVATARS } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, Avatar, Button, Progress, Tag, LoadingBlock, EmptyState } from '../components/ui/index.jsx';
import { ACH_LABELS } from '../lib/hooks.js';
import { gameById } from '../games/registry.js';
import { useToast } from '../context/ToastContext.jsx';

const ACCENTS = { violet: '#7c5cff', bleu: '#588cff', teal: '#22d3be', rose: '#ec4899', orange: '#fb923c', vert: '#34d399' };

const ALL_ACH = Object.keys(ACH_LABELS);

// Titre de joueur en fonction du niveau (cosmétique).
function playerTitle(level) {
  if (level >= 30) return '👑 Légende';
  if (level >= 20) return '💎 Maître';
  if (level >= 12) return '🔥 Vétéran';
  if (level >= 6) return '⚡ Confirmé';
  if (level >= 3) return '🌟 Apprenti';
  return '🎮 Débutant';
}

export default function Profile() {
  const { user, logout, setAvatar, updateProfile, openAuth } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: '', bio: '', accent: 'violet' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api('/api/me/profile').then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [user]);
  useEffect(() => { if (user) setForm({ displayName: user.displayName || '', bio: user.bio || '', accent: user.accent || 'violet' }); }, [user, editing]);

  if (!user) return (
    <div className="py-16"><EmptyState icon={Lock} title="Connecte-toi pour voir ton profil" hint="Ton XP, tes niveaux, tes records et tes succès t'attendent." action={<Button onClick={() => openAuth('login')}>Se connecter</Button>} /></div>
  );
  if (loading) return <LoadingBlock />;

  const lv = user.levelInfo || { level: user.level, into: 0, need: 100 };
  const pct = Math.round((lv.into / lv.need) * 100);
  const stats = data?.stats || { played: 0, wins: 0, perGame: [] };
  const winrate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const owned = new Set(data?.achievements || []);
  const accentColor = ACCENTS[user.accent] || ACCENTS.violet;

  const save = async () => {
    setSaving(true);
    try { await updateProfile(form); toast.success('Profil mis à jour !'); setEditing(false); }
    catch { toast.error('Erreur, réessaie.'); } finally { setSaving(false); }
  };

  return (
    <div className="py-8 space-y-6">
      {/* En-tête profil avec bannière colorée */}
      <Card className="overflow-hidden">
        <div className="h-24 md:h-28" style={{ background: `linear-gradient(120deg, ${accentColor}, ${accentColor}44)` }} />
        <div className="p-6 -mt-12">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="rounded-full ring-4 ring-surface"><Avatar name={user.avatar} label={user.username} size={80} /></div>
            <div className="flex-1 min-w-[12rem] pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display font-bold text-2xl">{user.displayName || user.username}</h1>
                <Tag color="brand">Niveau {lv.level}</Tag>
              </div>
              <p className="text-sm mt-0.5"><span className="text-brand font-semibold">{playerTitle(lv.level)}</span> <span className="text-muted">· @{user.username} · {user.xp} XP</span></p>
              {user.bio && <p className="text-sm text-muted mt-1 max-w-lg">{user.bio}</p>}
            </div>
            <div className="flex gap-2 pb-1">
              <Button variant="outline" size="sm" onClick={() => setEditing(e => !e)}><Pencil className="h-4 w-4" /> Modifier</Button>
              <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="mt-4 max-w-sm">
            <div className="flex justify-between text-xs text-muted mb-1"><span>Niveau {lv.level}</span><span>{lv.into}/{lv.need} XP</span></div>
            <Progress value={pct} />
          </div>
        </div>
      </Card>

      {/* Panneau d'édition */}
      {editing && (
        <Card className="p-5 space-y-4 animate-slideUp">
          <h2 className="font-semibold">Personnaliser mon profil</h2>
          <div>
            <label className="text-xs font-semibold text-muted">Nom affiché</label>
            <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} maxLength={24} placeholder={user.username}
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted">Bio</label>
            <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} maxLength={200} rows={2} placeholder="Quelques mots sur toi…"
              className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-brand resize-none" />
            <div className="text-right text-[10px] text-muted">{form.bio.length}/200</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted">Couleur d'accent</label>
            <div className="flex gap-2 mt-2">
              {Object.entries(ACCENTS).map(([k, c]) => (
                <button key={k} onClick={() => setForm(f => ({ ...f, accent: k }))} className={`h-8 w-8 rounded-full border-2 transition-transform ${form.accent === k ? 'border-text scale-110' : 'border-transparent'}`} style={{ background: c }} aria-label={k} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted">Avatar</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {AVATARS.map(av => (
                <button key={av} onClick={() => setAvatar(av)} className={`rounded-full transition-transform ${user.avatar === av ? 'ring-2 ring-brand scale-110' : 'opacity-70 hover:opacity-100'}`}>
                  <Avatar name={av} label={user.username} size={38} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} loading={saving}><Check className="h-4 w-4" /> Enregistrer</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}><X className="h-4 w-4" /> Annuler</Button>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Gamepad2} label="Parties jouées" value={stats.played} />
        <Stat icon={Trophy} label="Victoires" value={stats.wins} />
        <Stat icon={Target} label="Taux de victoire" value={`${winrate}%`} />
        <Stat icon={Award} label="Succès" value={`${owned.size}/${ALL_ACH.length}`} />
      </div>

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
