import React, { useEffect, useRef, useState } from 'react';
import { UserPlus, Users2, Search, Check, X, UserMinus, Gamepad2, Clock, Lock, Ban, Flag, Star, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useFriends, activityLabel } from '../context/FriendsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { Card, Button, Avatar, Tag, EmptyState } from '../components/ui/index.jsx';
import { useNavigate } from 'react-router-dom';

function agoShort(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'à l\u2019instant';
  const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24); if (d < 7) return `il y a ${d} j`;
  return new Date(ts).toLocaleDateString('fr-FR');
}

export default function Friends() {
  const { user, openAuth } = useAuth();
  const friends = useFriends();
  const toast = useToast();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try { const d = await api(`/api/users/search?q=${encodeURIComponent(q.trim())}`); setResults(d.results); } catch { /* ignore */ } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [q]);

  if (!user) return (
    <div className="py-16"><EmptyState icon={Lock} title="Connecte-toi pour retrouver tes amis" hint="Ajoute tes amis, vois qui est en ligne et invite-les à jouer en un clic." action={<Button onClick={() => openAuth('login')}>Se connecter</Button>} /></div>
  );

  const add = async (username) => {
    try { const st = await friends.addByUsername(username);
      if (st === 'sent') toast.success('Demande envoyée !');
      else if (st === 'accepted') toast.success('Vous êtes maintenant amis ! 🎉');
      else if (st === 'already') toast.info('Vous êtes déjà amis.');
      setResults(rs => rs.map(r => r.username === username ? { ...r, relation: st === 'accepted' ? 'friend' : 'sent' } : r));
    } catch (e) { toast.error(e.error === 'user_not_found' ? 'Utilisateur introuvable.' : 'Erreur.'); }
  };

  return (
    <div className="py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl md:text-4xl inline-flex items-center gap-2"><Users2 className="h-7 w-7 text-brand" /> Amis</h1>
        <p className="text-muted mt-1">{friends.onlineCount} ami{friends.onlineCount > 1 ? 's' : ''} en ligne · {friends.friends.length} au total</p>
      </div>

      {/* Ajouter un ami */}
      <Card className="p-5">
        <h2 className="font-semibold mb-3 inline-flex items-center gap-2"><UserPlus className="h-4 w-4 text-brand" /> Ajouter un ami</h2>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un pseudo…"
            className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-4 py-3 text-sm outline-none focus:border-brand" />
        </div>
        {q.trim().length >= 2 && (
          <div className="mt-3 space-y-2">
            {searching && <p className="text-xs text-muted">Recherche…</p>}
            {!searching && results.length === 0 && <p className="text-xs text-muted">Aucun joueur trouvé pour « {q} ».</p>}
            {results.map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                <Avatar name={r.avatar} label={r.username} size={34} />
                <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{r.username}</div><div className="text-xs text-muted">Niveau {r.level}</div></div>
                {r.relation === 'friend' ? <Tag color="success">Ami</Tag>
                  : r.relation === 'sent' ? <Tag color="muted">Demandé</Tag>
                  : r.relation === 'incoming' ? <Button size="sm" onClick={() => friends.accept(r.id)}>Accepter</Button>
                  : <Button size="sm" variant="outline" onClick={() => add(r.username)}><UserPlus className="h-4 w-4" /> Ajouter</Button>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Demandes reçues */}
      {friends.incoming.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Demandes reçues ({friends.incoming.length})</h2>
          <div className="space-y-2">
            {friends.incoming.map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                <Avatar name={r.avatar} label={r.username} size={34} />
                <span className="flex-1 font-semibold text-sm truncate">{r.username}</span>
                <Button size="sm" onClick={() => friends.accept(r.id)}><Check className="h-4 w-4" /> Accepter</Button>
                <Button size="sm" variant="ghost" onClick={() => friends.decline(r.id)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Liste d'amis */}
      <Card className="p-5">
        <h2 className="font-semibold mb-3">Mes amis</h2>
        {friends.friends.length === 0 ? (
          <EmptyState icon={Users2} title="Ton équipe t'attend." hint="Ajoute des amis pour les voir apparaître ici et les inviter à jouer." />
        ) : (
          <div className="space-y-2">
            {friends.friends.map(f => {
              const st = activityLabel(f);
              return (
                <div key={f.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                  <button onClick={() => friends.favorite(f.id, !f.favorite)} title={f.favorite ? 'Retirer des favoris' : 'Mettre en favori'} className={`${f.favorite ? 'text-warning' : 'text-muted hover:text-warning'}`}>
                    <Star className={`h-4 w-4 ${f.favorite ? 'fill-warning' : ''}`} />
                  </button>
                  <button onClick={() => nav(`/u/${f.id}`)} className="relative">
                    <Avatar name={f.avatar} label={f.username} size={38} />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${st.dot}`} />
                  </button>
                  <button onClick={() => nav(`/u/${f.id}`)} className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-semibold truncate hover:text-brand transition-colors">{friends.nameOf(f)} <span className="text-xs text-muted">· Nv.{f.level}</span></div>
                    <div className={`text-xs ${f.online ? st.color : 'text-muted'}`}>{f.online ? st.text : (f.lastSeen ? `vu ${agoShort(f.lastSeen)}` : 'hors ligne')}</div>
                  </button>
                  <button onClick={async () => { const n = window.prompt(`Surnom pour ${f.displayName || f.username} :`, f.nickname || ''); if (n !== null) { await friends.setNickname(f.id, n); toast.success('Surnom mis à jour.'); } }} title="Surnom" className="text-muted hover:text-brand p-2"><Pencil className="h-4 w-4" /></button>
                  {st.code && <Button size="sm" variant="outline" onClick={() => { try { sessionStorage.setItem('pr_identity', JSON.stringify({ name: user.username, avatar: user.avatar })); } catch { /* ignore */ } nav(`/salon/${st.code}`); }}><Gamepad2 className="h-4 w-4" /> Rejoindre</Button>}
                  <button onClick={async () => { await friends.report(f.id, 'signalé'); toast.success('Signalement envoyé. Merci.'); }} title="Signaler" className="text-muted hover:text-warning p-2"><Flag className="h-4 w-4" /></button>
                  <button onClick={async () => { if (confirm(`Bloquer ${f.username} ? Vous ne serez plus amis.`)) { await friends.block(f.id); toast.info(`${f.username} bloqué.`); } }} title="Bloquer" className="text-muted hover:text-danger p-2"><Ban className="h-4 w-4" /></button>
                  <button onClick={() => friends.remove(f.id)} title="Retirer" className="text-muted hover:text-danger p-2"><UserMinus className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Demandes envoyées */}
      {friends.outgoing.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold mb-3 text-muted text-sm inline-flex items-center gap-2"><Clock className="h-4 w-4" /> Demandes envoyées</h2>
          <div className="flex flex-wrap gap-2">
            {friends.outgoing.map(r => (
              <span key={r.id} className="inline-flex items-center gap-2 rounded-full bg-surface-2 pl-1 pr-2 py-1 text-xs">
                <Avatar name={r.avatar} label={r.username} size={22} /> {r.username}
                <button onClick={() => friends.cancel(r.id)} className="text-muted hover:text-danger"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Bloqués */}
      {friends.blocked?.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold mb-3 text-muted text-sm inline-flex items-center gap-2"><Ban className="h-4 w-4" /> Bloqués</h2>
          <div className="space-y-2">
            {friends.blocked.map(b => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
                <Avatar name={b.avatar} label={b.username} size={30} />
                <span className="flex-1 text-sm font-medium truncate">{b.username}</span>
                <Button size="sm" variant="outline" onClick={() => friends.unblock(b.id)}>Débloquer</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
