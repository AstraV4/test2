import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Gamepad2, Target, Award, UserPlus, MessageCircle, Check, Star, Heart } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFriends } from '../context/FriendsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Card, Avatar, Button, Tag, Progress, LoadingBlock, EmptyState } from '../components/ui/index.jsx';
import { ACH_LABELS } from '../lib/hooks.js';
import { burstConfetti } from '../components/PlayAgain.jsx';

const ACCENTS = { violet: '#7c5cff', bleu: '#588cff', teal: '#22d3be', rose: '#ec4899', orange: '#fb923c', vert: '#34d399' };
const ALL_ACH = Object.keys(ACH_LABELS);
function playerTitle(level) {
  if (level >= 30) return '👑 Légende'; if (level >= 20) return '💎 Maître'; if (level >= 12) return '🔥 Vétéran';
  if (level >= 6) return '⚡ Confirmé'; if (level >= 3) return '🌟 Apprenti'; return '🎮 Débutant';
}

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const friends = useFriends();
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rel, setRel] = useState('none');
  const [crush, setCrush] = useState(null); // { iSet, mutual }

  useEffect(() => {
    setLoading(true);
    api(`/api/users/${id}/profile`).then(d => { setData(d); setRel(d.relation); }).catch(() => setData(null)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    if (rel === 'friend') api(`/api/crush/${id}`).then(setCrush).catch(() => {});
  }, [rel, id]);

  if (loading) return <LoadingBlock />;
  if (!data) return <div className="py-16"><EmptyState icon={ArrowLeft} title="Profil introuvable" action={<Button onClick={() => nav(-1)}>Retour</Button>} /></div>;

  // Si c'est mon propre profil, rediriger vers l'édition
  if (rel === 'self') return <div className="py-16"><EmptyState icon={Gamepad2} title="C'est ton profil !" action={<Button as={Link} to="/profil">Voir mon profil</Button>} /></div>;

  const u = data.user;
  const lv = u.levelInfo || { level: u.level, into: 0, need: 100 };
  const accent = ACCENTS[u.accent] || ACCENTS.violet;
  const stats = data.stats || { played: 0, wins: 0 };
  const winrate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const owned = new Set(data.achievements || []);
  const favorite = friends?.friends?.find(f => f.id === u.id)?.favorite;

  const addFriend = async () => { try { await friends.addByUsername(u.username); setRel('sent'); toast.success('Demande envoyée !'); } catch { toast.error('Erreur.'); } };
  const toggleFav = async () => { await api('/api/friends/favorite', { method: 'POST', body: { userId: u.id, on: !favorite } }); friends.refresh(); };
  const toggleCrush = async () => {
    const next = !crush?.iSet;
    try { const r = await api(`/api/crush/${u.id}`, { method: 'POST', body: { on: next } }); setCrush(r); if (r.mutual) burstConfetti(); else if (next) toast.info('C\u2019est noté, en secret 🤫'); }
    catch { toast.error('Erreur.'); }
  };

  return (
    <div className="py-8 space-y-6">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> Retour</button>

      <Card className="overflow-hidden">
        <div className="h-24 md:h-28" style={{ background: `linear-gradient(120deg, ${accent}, ${accent}44)` }} />
        <div className="p-6 -mt-12">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="rounded-full ring-4 ring-surface relative">
              <Avatar name={u.avatar} label={u.username} size={80} />
              {data.online && <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-success border-2 border-surface" />}
            </div>
            <div className="flex-1 min-w-[12rem] pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display font-bold text-2xl">{u.displayName || u.username}</h1>
                <Tag color="brand">Niveau {lv.level}</Tag>
              </div>
              <p className="text-sm mt-0.5"><span className="text-brand font-semibold">{playerTitle(lv.level)}</span> <span className="text-muted">· @{u.username} · {u.xp} XP</span></p>
              {u.bio && <p className="text-sm text-muted mt-1 max-w-lg">{u.bio}</p>}
              {data.duo?.streak > 0 && <p className="text-sm text-warning font-semibold mt-1 inline-flex items-center gap-1"><Star className="h-4 w-4 fill-warning" /> {data.duo.streak} jour{data.duo.streak > 1 ? 's' : ''} de suite à jouer ensemble{data.duo.best > data.duo.streak ? ` (record : ${data.duo.best})` : ''}</p>}
              {rel === 'friend' && data.friendsSince && (() => {
                const days = Math.max(0, Math.floor((Date.now() - data.friendsSince) / 86400000));
                const milestone = [365, 180, 100, 30, 7].find(m => days >= m);
                const label = days === 0 ? "Amis depuis aujourd'hui 🎉" : `Amis depuis ${days} jour${days > 1 ? 's' : ''}`;
                return <p className="text-sm text-rose-400 font-semibold mt-1 inline-flex items-center gap-1"><Heart className="h-4 w-4 fill-rose-400/40" /> {label}{milestone ? ` · ${milestone === 365 ? '1 an 🥳' : milestone === 180 ? '6 mois 🎊' : milestone + ' jours 🎉'}` : ''}</p>;
              })()}
            </div>
            {user && (
              <div className="flex gap-2 pb-1">
                {rel === 'friend' ? (
                  <>
                    <Button size="sm" variant={favorite ? 'primary' : 'outline'} onClick={toggleFav}><Star className={`h-4 w-4 ${favorite ? 'fill-white' : ''}`} /> {favorite ? 'Favori' : 'Favori'}</Button>
                    <Button size="sm" onClick={() => nav(`/messages/${u.id}`)}><MessageCircle className="h-4 w-4" /> Message</Button>
                  </>
                ) : rel === 'sent' ? <Tag color="muted">Demande envoyée</Tag>
                  : rel === 'incoming' ? <Button size="sm" onClick={() => { friends.accept(u.id); setRel('friend'); }}><Check className="h-4 w-4" /> Accepter</Button>
                  : <Button size="sm" onClick={addFriend}><UserPlus className="h-4 w-4" /> Ajouter</Button>}
              </div>
            )}
          </div>
          <div className="mt-4 max-w-sm">
            <div className="flex justify-between text-xs text-muted mb-1"><span>Niveau {lv.level}</span><span>{lv.into}/{lv.need} XP</span></div>
            <Progress value={Math.round((lv.into / lv.need) * 100)} />
          </div>
        </div>
      </Card>

      {/* Crush secret (entre amis) */}
      {rel === 'friend' && crush && (
        <Card className={`p-5 ${crush.mutual ? 'gradient-border' : ''}`} style={crush.mutual ? { background: 'linear-gradient(120deg, rgba(236,72,153,0.12), rgba(124,92,255,0.08))' } : undefined}>
          {crush.mutual ? (
            <div className="text-center space-y-2">
              <div className="text-4xl">💞</div>
              <h3 className="font-display font-bold text-xl">C'est réciproque !</h3>
              <p className="text-sm text-muted">Toi et {u.displayName || u.username}, vous avez tous les deux craqué. Le secret est révélé — à vous de jouer maintenant. 💛</p>
              <Button size="sm" onClick={() => nav(`/messages/${u.id}`)} className="mt-1"><MessageCircle className="h-4 w-4" /> Lui écrire</Button>
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400"><Heart className={`h-6 w-6 ${crush.iSet ? 'fill-rose-400' : ''}`} /></div>
              <div className="flex-1 min-w-[12rem]">
                <h3 className="font-semibold">Crush secret</h3>
                <p className="text-sm text-muted">{crush.iSet ? 'Ton crush est enregistré, en secret 🤫. Si l\u2019autre craque aussi, vous le saurez tous les deux — sinon personne ne le sait, jamais.' : 'Tu craques pour cette personne ? Coche en secret. Ça ne se révèle que si c\u2019est réciproque.'}</p>
              </div>
              <Button variant={crush.iSet ? 'primary' : 'outline'} onClick={toggleCrush}>
                <Heart className={`h-4 w-4 ${crush.iSet ? 'fill-white' : ''}`} /> {crush.iSet ? 'Crush activé' : 'J\u2019ai un crush'}
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Gamepad2} label="Parties" value={stats.played} />
        <Stat icon={Trophy} label="Victoires" value={stats.wins} />
        <Stat icon={Target} label="Taux de victoire" value={`${winrate}%`} />
        <Stat icon={Award} label="Succès" value={`${owned.size}/${ALL_ACH.length}`} />
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Succès débloqués</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_ACH.map(code => {
            const has = owned.has(code);
            return <div key={code} className={`rounded-xl px-3 py-3 text-sm border ${has ? 'border-brand/40 bg-brand/5' : 'border-border bg-surface-2 opacity-50'}`}><div className={has ? '' : 'grayscale'}>{ACH_LABELS[code]}</div></div>;
          })}
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return <Card className="p-4"><Icon className="h-5 w-5 text-brand mb-2" /><div className="text-2xl font-display font-bold">{value}</div><div className="text-xs text-muted">{label}</div></Card>;
}
