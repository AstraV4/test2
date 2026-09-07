import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Clock, Gauge, Users2, Trophy, LogIn } from 'lucide-react';
import { gameBySlug } from '../games/registry.js';
import { Button, Card, Tag, EmptyState } from '../components/ui/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Chargement des composants de jeu (solo)
import Reaction from '../games/reaction/Reaction.jsx';
import Memory from '../games/memory/Memory.jsx';
import NumberGuess from '../games/number/NumberGuess.jsx';
import Anagram from '../games/anagram/Anagram.jsx';
import Quiz from '../games/quiz/Quiz.jsx';
import Semantic from '../games/semantic/Semantic.jsx';
import MathRush from '../games/mathrush/MathRush.jsx';
import TypeRush from '../games/typerush/TypeRush.jsx';
import MemGrid from '../games/memgrid/MemGrid.jsx';

const SOLO = { reaction: Reaction, memory: Memory, number: NumberGuess, anagram: Anagram, quiz: Quiz, semantic: Semantic, mathrush: MathRush, typerush: TypeRush, memgrid: MemGrid };

export default function GameDetail() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { user, openAuth } = useAuth();
  const game = gameBySlug(slug);

  if (!game) return <div className="py-16"><EmptyState icon={ArrowLeft} title="Jeu introuvable" action={<Button as={Link} to="/jeux">Retour aux jeux</Button>} /></div>;

  const Icon = game.icon; const [a, b] = game.color;
  const GameComp = SOLO[game.id];

  return (
    <div className="py-8 space-y-6">
      <Link to="/jeux" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> Tous les jeux</Link>

      <Card className="overflow-hidden">
        <div className="relative h-32 md:h-40" style={{ background: `linear-gradient(135deg, ${a}33, ${b}22)` }}>
          <div className="absolute -right-6 -bottom-6 opacity-20"><Icon className="h-40 w-40" style={{ color: a }} strokeWidth={1} /></div>
          <div className="absolute bottom-4 left-5 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}><Icon className="h-7 w-7" /></div>
            <div>
              <h1 className="font-display font-bold text-2xl md:text-3xl">{game.name}</h1>
              <p className="text-muted text-sm">{game.tagline}</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2 mb-4">
            <Tag color={game.mode === 'multi' ? 'warning' : 'brand'}>{game.mode === 'multi' ? 'Multijoueur' : 'Solo'}</Tag>
            {game.category.map(c => <Tag key={c} color="muted">{c}</Tag>)}
            {game.isNew && <Tag color="accent">Nouveau</Tag>}
          </div>
          <p className="text-sm text-muted leading-relaxed max-w-2xl">{game.description}</p>
          <div className="flex flex-wrap gap-5 mt-5 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> {game.players} joueur(s)</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {game.duration}</span>
            <span className="inline-flex items-center gap-1.5"><Gauge className="h-4 w-4" /> {game.difficulty}</span>
          </div>
        </div>
      </Card>

      {/* Zone de jeu */}
      {game.mode === 'multi' ? (
        <Card className="p-8 text-center">
          <Users2 className="h-10 w-10 mx-auto mb-3 text-brand" />
          <h2 className="font-display font-bold text-xl mb-2">Jeu multijoueur en temps réel</h2>
          <p className="text-sm text-muted mb-6 max-w-md mx-auto">Crée un salon ou rejoins tes amis avec un code pour lancer une partie.</p>
          <Button size="lg" onClick={() => nav('/multijoueur')}><Users2 className="h-4 w-4" /> Aller au multijoueur</Button>
        </Card>
      ) : (
        <div>
          {!user && (
            <Card className="p-4 mb-4 flex items-center justify-between gap-3 flex-wrap bg-brand/5">
              <p className="text-sm text-muted inline-flex items-center gap-2"><Trophy className="h-4 w-4 text-brand" /> Connecte-toi pour sauvegarder ton score et gagner de l'XP.</p>
              <Button size="sm" variant="outline" onClick={() => openAuth('login')}><LogIn className="h-4 w-4" /> Se connecter</Button>
            </Card>
          )}
          <Card className="p-5">
            {GameComp ? <GameComp /> : <EmptyState title="Bientôt disponible" />}
          </Card>
        </div>
      )}
    </div>
  );
}
