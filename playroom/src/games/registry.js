import { Zap, Brain, Hash, Shuffle, HelpCircle, Sparkles, Ghost, Calculator, Keyboard, Grid3x3, Palette } from 'lucide-react';

// Métadonnées communes à tous les jeux. Ajouter un jeu = ajouter une entrée ici
// + un composant dans src/games/<id>/. Le reste (fiche, routes, cartes) est générique.
// ambiance : identité visuelle de la carte ('space','word','speed','mystery','logic','number','grid','type').
export const GAMES = [
  {
    id: 'semantic', slug: 'proximo', name: 'Proximo', icon: Sparkles,
    tagline: 'Trouve le mot secret à la proximité de sens.',
    description: "Un mot mystère est caché. Propose des mots : plus le sens est proche, plus le score grimpe. Un nouveau mot chaque jour, identique pour tous.",
    color: ['#7c5cff', '#588cff'], ambiance: 'space', mode: 'solo', category: ['Pour réfléchir', 'Jeux de mots'],
    players: '1', duration: '5-15 min', difficulty: 'Moyen', avgScore: 62, tags: ['Solo', 'Réflexion'],
    featured: true, isNew: false,
  },
  {
    id: 'reaction', slug: 'reflexe', name: 'Réflexe', icon: Zap,
    tagline: 'Clique dès que l\u2019écran change. Sois rapide.',
    description: "Attends le signal vert, puis clique le plus vite possible. On mesure ton temps de réaction sur plusieurs essais. Le meilleur des rapides gagne.",
    color: ['#facc15', '#f97316'], ambiance: 'speed', mode: 'solo', category: ['Parties rapides'],
    players: '1', duration: '1-2 min', difficulty: 'Facile', avgScore: 640, tags: ['Solo', 'Rapide'],
    featured: true, isNew: false,
  },
  {
    id: 'memory', slug: 'memoire', name: 'Mémoire', icon: Brain,
    tagline: 'Répète la séquence lumineuse qui s\u2019allonge.',
    description: "Une séquence de couleurs s'illumine. Reproduis-la. À chaque manche réussie, elle s'allonge. Jusqu'où ira ta mémoire ?",
    color: ['#34d399', '#22d3be'], ambiance: 'logic', mode: 'solo', category: ['Pour réfléchir'],
    players: '1', duration: '2-5 min', difficulty: 'Moyen', avgScore: 7, tags: ['Solo', 'Réflexion'],
    featured: false, isNew: false,
  },
  {
    id: 'number', slug: 'nombre-mystere', name: 'Nombre Mystère', icon: Hash,
    tagline: 'Devine le nombre avec un minimum d\u2019essais.',
    description: "Un nombre entre 1 et 100 est choisi. À chaque proposition, on te dit « plus haut » ou « plus bas ». Trouve-le en un minimum d'essais.",
    color: ['#22d3ee', '#3b82f6'], ambiance: 'number', mode: 'solo', category: ['Pour réfléchir', 'Parties rapides'],
    players: '1', duration: '1-3 min', difficulty: 'Facile', avgScore: 62, tags: ['Solo', 'Rapide'],
    featured: false, isNew: false,
  },
  {
    id: 'anagram', slug: 'mot-melange', name: 'Mot Mélangé', icon: Shuffle,
    tagline: 'Reconstitue le mot à partir des lettres mélangées.',
    description: "Des lettres sont mélangées : à toi de retrouver le mot d'origine le plus vite possible. Chaque bonne réponse enchaîne un nouveau mot.",
    color: ['#f472b6', '#a855f7'], ambiance: 'word', mode: 'solo', category: ['Jeux de mots'],
    players: '1', duration: '2-5 min', difficulty: 'Moyen', avgScore: 8, tags: ['Solo', 'Mots'],
    featured: false, isNew: false,
  },
  {
    id: 'quiz', slug: 'quiz', name: 'Quiz Éclair', icon: HelpCircle,
    tagline: '10 questions, un chrono, une série à tenir.',
    description: "Dix questions de culture générale, un temps limité par question. Enchaîne les bonnes réponses pour gonfler ton score et ta série.",
    color: ['#fb923c', '#f43f5e'], ambiance: 'logic', mode: 'solo', category: ['Pour réfléchir', 'Compétitif'],
    players: '1', duration: '3-5 min', difficulty: 'Moyen', avgScore: 11, tags: ['Solo', 'Culture'],
    featured: true, isNew: false,
  },
  {
    id: 'mathrush', slug: 'calcul-rapide', name: 'Calcul Rapide', icon: Calculator,
    tagline: 'Enchaîne les opérations avant la fin du chrono.',
    description: "Résous un maximum d'opérations en 45 secondes. Les bonnes réponses consécutives font grimper un combo qui multiplie ton score. Rapide et nerveux.",
    color: ['#38bdf8', '#6366f1'], ambiance: 'number', mode: 'solo', category: ['Parties rapides', 'Pour réfléchir', 'Compétitif'],
    players: '1', duration: '1 min', difficulty: 'Moyen', avgScore: 18, tags: ['Solo', 'Rapide'],
    featured: true, isNew: true,
  },
  {
    id: 'typerush', slug: 'frappe-rapide', name: 'Frappe Rapide', icon: Keyboard,
    tagline: 'Tape le texte le plus vite et le plus juste possible.',
    description: "Un texte apparaît : recopie-le sans erreur. On mesure ta vitesse en mots/minute (WPM) et ta précision. Ton score = WPM ajusté à ta précision.",
    color: ['#2dd4bf', '#0ea5e9'], ambiance: 'type', mode: 'solo', category: ['Parties rapides', 'Compétitif'],
    players: '1', duration: '1-2 min', difficulty: 'Moyen', avgScore: 45, tags: ['Solo', 'Rapide'],
    featured: false, isNew: true,
  },
  {
    id: 'memgrid', slug: 'grille-memoire', name: 'Memory Grid', icon: Grid3x3,
    tagline: 'Mémorise les cases allumées, puis reproduis-les.',
    description: "Des cases s'illuminent brièvement sur une grille. Mémorise-les puis clique-les de mémoire. La grille grandit à chaque manche réussie.",
    color: ['#a78bfa', '#ec4899'], ambiance: 'grid', mode: 'solo', category: ['Pour réfléchir', 'Compétitif'],
    players: '1', duration: '2-4 min', difficulty: 'Difficile', avgScore: 6, tags: ['Solo', 'Réflexion'],
    featured: true, isNew: true,
  },
  {
    id: 'imposter', slug: 'imposteur', name: 'Imposteur', icon: Ghost,
    tagline: 'Un mot, des indices… et un menteur parmi vous.',
    description: "Chacun reçoit le même mot secret — sauf l'imposteur. Donnez des indices à tour de rôle, discutez, puis votez pour démasquer l'intrus. Jouable à plusieurs en ligne.",
    color: ['#f43f5e', '#7c5cff'], ambiance: 'mystery', mode: 'multi', category: ['Entre amis', 'Multijoueur', 'Social'],
    players: '3-12', duration: '10-20 min', difficulty: 'Moyen', avgScore: null, tags: ['Multijoueur', 'Entre amis'],
    featured: true, isNew: false,
  },
  {
    id: 'draw', slug: 'draw-and-guess', name: 'Draw & Guess', icon: Palette,
    tagline: 'Dessine le mot, les autres devinent en temps réel.',
    description: "Chacun son tour, un joueur reçoit un mot et le dessine sur un canvas partagé. Les autres tapent leurs réponses dans le chat : plus tu devines vite, plus tu marques. Podium à la fin.",
    color: ['#22d3ee', '#a855f7'], ambiance: 'word', mode: 'multi', category: ['Entre amis', 'Multijoueur', 'Créatif'],
    players: '3-12', duration: '10-20 min', difficulty: 'Facile', avgScore: null, tags: ['Multijoueur', 'Entre amis', 'Créatif'],
    featured: true, isNew: true,
  },
];

export const gameById = (id) => GAMES.find(g => g.id === id);
export const gameBySlug = (slug) => GAMES.find(g => g.slug === slug);

// Catégories premium avec emoji + filtre.
export const CATEGORIES = [
  { key: 'Tendances', emoji: '🔥', match: (g) => g.featured },
  { key: 'Nouveautés', emoji: '🆕', match: (g) => g.isNew },
  { key: 'Parties rapides', emoji: '⚡', match: (g) => g.category.includes('Parties rapides') },
  { key: 'Pour réfléchir', emoji: '🧠', match: (g) => g.category.includes('Pour réfléchir') },
  { key: 'Entre amis', emoji: '😂', match: (g) => g.category.includes('Entre amis') || g.mode === 'multi' },
  { key: 'Compétitif', emoji: '🏆', match: (g) => g.category.includes('Compétitif') },
  { key: 'Multijoueur', emoji: '👥', match: (g) => g.mode === 'multi' },
  { key: 'Jeux de mots', emoji: '✍️', match: (g) => g.category.includes('Jeux de mots') },
  { key: 'Solo', emoji: '🧍', match: (g) => g.mode === 'solo' },
];

export function filterByCategory(key) {
  const cat = CATEGORIES.find(c => c.key === key);
  return cat ? GAMES.filter(cat.match) : GAMES;
}
