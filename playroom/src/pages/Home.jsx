import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Users2, Trophy, Sparkles, ArrowRight, Gamepad2, Flame, Zap } from 'lucide-react';
import { GAMES, CATEGORIES } from '../games/registry.js';
import GameCard from '../components/game/GameCard.jsx';
import { Button, Card, Avatar, Tag } from '../components/ui/index.jsx';
import { api } from '../lib/api.js';
import { gameById } from '../games/registry.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user, openAuth } = useAuth();
  const featured = GAMES.filter(g => g.featured);
  const [top, setTop] = useState([]);
  const [daily, setDaily] = useState(null);

  useEffect(() => {
    api('/api/leaderboard?game=xp').then(d => setTop(d.rows.slice(0, 5))).catch(() => {});
    api('/api/daily').then(setDaily).catch(() => {});
  }, []);

  const dailyGame = daily ? gameById(daily.game) : null;

  return (
    <div className="space-y-16 pb-16">
      {/* HERO */}
      <section className="relative pt-12 md:pt-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border glass px-3 py-1 text-xs text-muted mb-6 animate-slideUp">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" /><span className="relative inline-flex rounded-full h-2 w-2 bg-accent" /></span>
            {GAMES.length} jeux · solo & multijoueur en temps réel
          </div>
          <h1 className="font-display font-bold text-5xl md:text-7xl leading-[1.02] animate-slideUp">
            <span className="hero-title">Joue.</span> <span className="hero-title">Défie.</span><br className="hidden sm:block" /> <span className="gradient-text">Recommence.</span>
          </h1>
          <p className="text-muted text-lg md:text-xl mt-6 max-w-xl mx-auto animate-slideUp">
            La plateforme de mini-jeux où tu bats tes records en solo et démasques tes amis en ligne. Gratuit, sans installation.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8 animate-slideUp">
            <Button as={Link} to="/jeux" size="lg"><Play className="h-4 w-4" /> Jouer maintenant</Button>
            <Button as={Link} to="/multijoueur" variant="outline" size="lg"><Users2 className="h-4 w-4" /> Jouer avec des amis</Button>
          </div>
        </div>

        {/* Aperçu de jeux flottants */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto stagger">
          {featured.slice(0, 4).map((g, i) => {
            const Icon = g.icon; const [a, b] = g.color;
            return (
              <Link key={g.id} to={`/jeux/${g.slug}`} style={{ '--i': i }} className={`card-glow rounded-2xl p-4 ${i % 2 ? 'md:translate-y-5' : ''}`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white mb-3 shadow-lg" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}><Icon className="h-6 w-6" /></div>
                <div className="font-display font-bold text-sm">{g.name}</div>
                <div className="text-xs text-muted mt-0.5">{g.duration}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* DÉFI DU JOUR */}
      {dailyGame && (
        <section>
          <Link to="/defi" className="block group">
            <Card className="p-6 md:p-7 flex items-center gap-5 hover:border-warning/40 transition-colors overflow-hidden relative">
              <div className="absolute -right-4 -bottom-6 opacity-10"><Flame className="h-40 w-40 text-warning" /></div>
              <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-warning/15 text-warning"><Flame className="h-7 w-7" /></div>
              <div className="flex-1 relative">
                <Tag color="warning" className="mb-1">Défi du jour</Tag>
                <h3 className="font-display font-bold text-xl">{dailyGame.name}</h3>
                <p className="text-sm text-muted">Bats le meilleur score du jour et grimpe au classement.</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted group-hover:translate-x-1 group-hover:text-text transition-all" />
            </Card>
          </Link>
        </section>
      )}

      {/* CATÉGORIES */}
      <section>
        <h2 className="font-display font-bold text-xl md:text-2xl mb-4">Explore par envie</h2>
        <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
          {CATEGORIES.map(c => (
            <Link key={c.key} to="/jeux" className="flex-none rounded-2xl card px-4 py-3 hover:border-brand/40 hover:-translate-y-0.5 transition-all">
              <span className="text-2xl">{c.emoji}</span>
              <div className="text-sm font-semibold mt-1 whitespace-nowrap">{c.key}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* JEUX POPULAIRES */}
      <section>
        <SectionHead icon={Gamepad2} title="Jeux populaires" to="/jeux" cta="Tous les jeux" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {featured.map((g, i) => <div key={g.id} style={{ '--i': i }}><GameCard game={g} /></div>)}
        </div>
      </section>

      {/* MULTIJOUEUR */}
      <section>
        <Card className="overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="p-8 md:p-10 flex flex-col justify-center">
              <Tag color="warning" className="w-fit mb-3">Entre amis</Tag>
              <h2 className="font-display font-bold text-2xl md:text-3xl mb-3">Crée un salon, partage le code, jouez ensemble</h2>
              <p className="text-muted text-sm mb-6 max-w-md">Lance une partie d'Imposteur en temps réel : chacun reçoit le même mot… sauf un. Donnez des indices, discutez, et démasquez l'intrus.</p>
              <div className="flex gap-3">
                <Button as={Link} to="/multijoueur"><Users2 className="h-4 w-4" /> Créer un salon</Button>
                <Button as={Link} to="/jeux/imposteur" variant="outline">En savoir plus</Button>
              </div>
            </div>
            <div className="relative bg-gradient-to-br from-brand/15 to-brand-2/10 p-8 flex items-center justify-center min-h-[15rem]">
              <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(12rem 10rem at 70% 30%, #f43f5e55, transparent)' }} />
              <div className="card rounded-2xl p-5 w-full max-w-xs shadow-card relative animate-floaty">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted">Code du salon</span>
                  <Tag color="success">4 en ligne</Tag>
                </div>
                <div className="font-display font-bold text-3xl tracking-[0.3em] text-center py-3 rounded-xl bg-surface-2 mb-3 gradient-text">X7K4P</div>
                <div className="flex -space-x-2">
                  {['comet', 'aurora', 'pulsar', 'orbit'].map((av, i) => <Avatar key={i} name={av} label={String.fromCharCode(65 + i)} size={30} ring />)}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* CLASSEMENT APERÇU */}
      <section>
        <SectionHead icon={Trophy} title="Meilleurs joueurs" to="/classements" cta="Voir le classement" />
        <Card className="divide-y divide-border overflow-hidden">
          {top.length === 0 && <div className="p-8 text-center text-sm text-muted">Sois le premier à marquer des points ! 🏆</div>}
          {top.map((r, i) => (
            <div key={r.userId} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/50 transition-colors">
              <span className="w-6 text-center font-bold">{i < 3 ? ['🥇', '🥈', '🥉'][i] : <span className="text-muted">{r.rank}</span>}</span>
              <Avatar name={r.avatar} label={r.username} size={34} />
              <span className="font-semibold flex-1 truncate">{r.username}</span>
              <Tag color="brand">Nv.{r.level}</Tag>
              <span className="font-mono text-sm text-muted w-16 text-right">{r.score} XP</span>
            </div>
          ))}
        </Card>
      </section>

      {/* CTA compte */}
      {!user && (
        <section>
          <Card className="p-8 md:p-10 text-center relative overflow-hidden gradient-border">
            <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(20rem 12rem at 50% 0%, rgb(var(--brand)/0.25), transparent)' }} />
            <div className="relative">
              <h2 className="font-display font-bold text-2xl md:text-3xl mb-2">Garde ta progression</h2>
              <p className="text-muted text-sm mb-6 max-w-md mx-auto">Crée un compte gratuit pour gagner de l'XP, monter en niveau, débloquer des succès et apparaître au classement.</p>
              <Button size="lg" onClick={() => openAuth('register')}><Zap className="h-4 w-4" /> Créer un compte gratuit</Button>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

function SectionHead({ icon: Icon, title, to, cta }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="font-display font-bold text-xl md:text-2xl inline-flex items-center gap-2"><Icon className="h-5 w-5 text-brand" /> {title}</h2>
      <Link to={to} className="text-sm text-muted hover:text-text inline-flex items-center gap-1 group">{cta} <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></Link>
    </div>
  );
}
