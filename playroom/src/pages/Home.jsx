import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Grid3x3, Users2, Trophy, Sparkles, ArrowRight, Gamepad2 } from 'lucide-react';
import { GAMES } from '../games/registry.js';
import GameCard from '../components/game/GameCard.jsx';
import { Button, Card, Avatar, Tag } from '../components/ui/index.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user, openAuth } = useAuth();
  const featured = GAMES.filter(g => g.featured);
  const [top, setTop] = useState([]);

  useEffect(() => { api('/api/leaderboard?game=xp').then(d => setTop(d.rows.slice(0, 5))).catch(() => {}); }, []);

  return (
    <div className="space-y-16 pb-16">
      {/* HERO */}
      <section className="relative pt-10 md:pt-16">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted mb-6 animate-slideUp">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> {GAMES.length} jeux · solo & multijoueur en temps réel
          </div>
          <h1 className="font-display font-bold text-4xl md:text-6xl leading-[1.05] animate-slideUp">
            Joue. Défie. <span className="gradient-text">Recommence.</span>
          </h1>
          <p className="text-muted text-lg mt-5 max-w-xl mx-auto animate-slideUp">
            Une plateforme de mini-jeux à jouer seul pour battre tes records, ou entre amis pour démasquer l'imposteur. Gratuit, dans ton navigateur.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8 animate-slideUp">
            <Button as={Link} to="/jeux" size="lg"><Play className="h-4 w-4" /> Jouer maintenant</Button>
            <Button as={Link} to="/multijoueur" variant="outline" size="lg"><Users2 className="h-4 w-4" /> Jouer avec des amis</Button>
          </div>
        </div>

        {/* Vignettes flottantes décoratives */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {featured.slice(0, 4).map((g, i) => {
            const Icon = g.icon; const [a, b] = g.color;
            return (
              <Link key={g.id} to={`/jeux/${g.slug}`} className={`card rounded-2xl p-4 hover:-translate-y-1 transition-transform ${i % 2 ? 'md:translate-y-4' : ''}`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white mb-3" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}><Icon className="h-5 w-5" /></div>
                <div className="font-display font-bold text-sm">{g.name}</div>
                <div className="text-xs text-muted mt-0.5">{g.duration}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* JEUX POPULAIRES */}
      <section>
        <SectionHead icon={Gamepad2} title="Jeux populaires" to="/jeux" cta="Tous les jeux" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.map(g => <GameCard key={g.id} game={g} />)}
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
            <div className="relative bg-gradient-to-br from-brand/15 to-brand-2/10 p-8 flex items-center justify-center min-h-[14rem]">
              <div className="card rounded-2xl p-5 w-full max-w-xs shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted">Code du salon</span>
                  <Tag color="success">4 en ligne</Tag>
                </div>
                <div className="font-display font-bold text-3xl tracking-[0.3em] text-center py-3 rounded-xl bg-surface-2 mb-3">X7K4P</div>
                <div className="flex -space-x-2">
                  {['comet', 'aurora', 'pulsar', 'orbit'].map((a, i) => <Avatar key={i} name={a} label={String.fromCharCode(65 + i)} size={30} ring />)}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* CLASSEMENT APERÇU */}
      <section>
        <SectionHead icon={Trophy} title="Meilleurs joueurs" to="/classements" cta="Voir le classement" />
        <Card className="divide-y divide-border">
          {top.length === 0 && <div className="p-6 text-center text-sm text-muted">Sois le premier à marquer des points !</div>}
          {top.map((r, i) => (
            <div key={r.userId} className="flex items-center gap-3 px-5 py-3">
              <span className={`w-6 text-center font-bold ${i === 0 ? 'text-warning' : i === 1 ? 'text-muted' : i === 2 ? 'text-orange-400' : 'text-muted'}`}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : r.rank}</span>
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
          <Card className="p-8 text-center bg-gradient-to-br from-brand/10 to-brand-2/5">
            <h2 className="font-display font-bold text-2xl mb-2">Garde ta progression</h2>
            <p className="text-muted text-sm mb-6 max-w-md mx-auto">Crée un compte gratuit pour gagner de l'XP, monter en niveau, débloquer des succès et apparaître au classement.</p>
            <Button size="lg" onClick={() => openAuth('register')}>Créer un compte gratuit</Button>
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
      <Link to={to} className="text-sm text-muted hover:text-text inline-flex items-center gap-1">{cta} <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );
}
