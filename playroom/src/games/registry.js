import { Zap, Brain, Hash, Shuffle, HelpCircle, Sparkles, Ghost } from 'lucide-react';

// Métadonnées communes à tous les jeux. Ajouter un jeu = ajouter une entrée ici
// + un composant dans src/games/<id>/. Le reste (fiche, routes, cartes) est générique.
export const GAMES = [
  {
    id: 'semantic', slug: 'proximo', name: 'Proximo', icon: Sparkles,
    tagline: 'Trouve le mot secret à la proximité de sens.',
    description: "Un mot mystère est caché. Propose des mots : plus le sens est proche, plus le score grimpe. Un nouveau mot chaque jour, identique pour tous.",
    color: ['#7c5cff', '#588cff'], mode: 'solo', category: ['Réflexion', 'Jeux de mots'],
    players: '1', duration: '5-15 min', difficulty: 'Moyen', tags: ['Solo', 'Réflexion'],
    featured: true, isNew: false,
  },
  {
    id: 'reaction', slug: 'reflexe', name: 'Réflexe', icon: Zap,
    tagline: 'Clique dès que l\u2019écran change. Sois rapide.',
    description: "Attends le signal vert, puis clique le plus vite possible. On mesure ton temps de réaction sur plusieurs essais. Le meilleur des rapides gagne.",
    color: ['#facc15', '#f97316'], mode: 'solo', category: ['Jeux rapides'],
    players: '1', duration: '1-2 min', difficulty: 'Facile', tags: ['Solo', 'Rapide'],
    featured: true, isNew: false,
  },
  {
    id: 'memory', slug: 'memoire', name: 'Mémoire', icon: Brain,
    tagline: 'Répète la séquence lumineuse qui s\u2019allonge.',
    description: "Une séquence de couleurs s'illumine. Reproduis-la. À chaque manche réussie, elle s'allonge. Jusqu'où ira ta mémoire ?",
    color: ['#34d399', '#22d3be'], mode: 'solo', category: ['Réflexion'],
    players: '1', duration: '2-5 min', difficulty: 'Moyen', tags: ['Solo', 'Réflexion'],
    featured: false, isNew: false,
  },
  {
    id: 'number', slug: 'nombre-mystere', name: 'Nombre Mystère', icon: Hash,
    tagline: 'Devine le nombre avec un minimum d\u2019essais.',
    description: "Un nombre entre 1 et 100 est choisi. À chaque proposition, on te dit « plus haut » ou « plus bas ». Trouve-le en un minimum d'essais.",
    color: ['#22d3ee', '#3b82f6'], mode: 'solo', category: ['Réflexion', 'Jeux rapides'],
    players: '1', duration: '1-3 min', difficulty: 'Facile', tags: ['Solo', 'Rapide'],
    featured: false, isNew: false,
  },
  {
    id: 'anagram', slug: 'mot-melange', name: 'Mot Mélangé', icon: Shuffle,
    tagline: 'Reconstitue le mot à partir des lettres mélangées.',
    description: "Des lettres sont mélangées : à toi de retrouver le mot d'origine le plus vite possible. Chaque bonne réponse enchaîne un nouveau mot.",
    color: ['#f472b6', '#a855f7'], mode: 'solo', category: ['Jeux de mots'],
    players: '1', duration: '2-5 min', difficulty: 'Moyen', tags: ['Solo', 'Mots'],
    featured: false, isNew: true,
  },
  {
    id: 'quiz', slug: 'quiz', name: 'Quiz Éclair', icon: HelpCircle,
    tagline: '10 questions, un chrono, une série à tenir.',
    description: "Dix questions de culture générale, un temps limité par question. Enchaîne les bonnes réponses pour gonfler ton score et ta série.",
    color: ['#fb923c', '#f43f5e'], mode: 'solo', category: ['Réflexion'],
    players: '1', duration: '3-5 min', difficulty: 'Moyen', tags: ['Solo', 'Culture'],
    featured: true, isNew: false,
  },
  {
    id: 'imposter', slug: 'imposteur', name: 'Imposteur', icon: Ghost,
    tagline: 'Un mot, des indices… et un menteur parmi vous.',
    description: "Chacun reçoit le même mot secret — sauf l'imposteur. Donnez des indices à tour de rôle, discutez, puis votez pour démasquer l'intrus. Jouable à plusieurs en ligne.",
    color: ['#f43f5e', '#7c5cff'], mode: 'multi', category: ['Entre amis', 'Multijoueur', 'Déduction'],
    players: '3-12', duration: '10-20 min', difficulty: 'Moyen', tags: ['Multijoueur', 'Entre amis'],
    featured: true, isNew: false,
  },
];

export const gameById = (id) => GAMES.find(g => g.id === id);
export const gameBySlug = (slug) => GAMES.find(g => g.slug === slug);

export const CATEGORIES = ['Populaires', 'Nouveautés', 'Solo', 'Multijoueur', 'Jeux rapides', 'Réflexion', 'Jeux de mots', 'Entre amis'];

export function filterByCategory(cat) {
  if (cat === 'Populaires') return GAMES.filter(g => g.featured);
  if (cat === 'Nouveautés') return GAMES.filter(g => g.isNew);
  if (cat === 'Solo') return GAMES.filter(g => g.mode === 'solo');
  if (cat === 'Multijoueur') return GAMES.filter(g => g.mode === 'multi');
  return GAMES.filter(g => g.category.includes(cat) || g.tags.includes(cat));
}
