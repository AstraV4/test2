// Données de jeux 100 % autonomes (aucune API externe requise).
// Le moteur sémantique est volontairement simple mais réel : chaque mot secret
// possède une liste de mots reliés classés par proximité. On combine ce classement
// avec une similarité de chaînes (Dice) pour couvrir les mots hors-liste.
// L'architecture permet de brancher plus tard un vrai modèle d'embeddings
// (voir server/semantic.js -> fonction similarity()).

export const SECRET_WORDS = [
  { word: 'ocean', related: ['mer', 'vague', 'eau', 'plage', 'sel', 'bateau', 'poisson', 'sable', 'marée', 'requin', 'profond', 'bleu', 'nager', 'tempête', 'corail', 'port', 'côte', 'sous-marin', 'baleine', 'algue'] },
  { word: 'montagne', related: ['sommet', 'neige', 'alpes', 'randonnée', 'roche', 'altitude', 'ski', 'vallée', 'pic', 'grimper', 'glacier', 'sentier', 'refuge', 'colline', 'escalade', 'crête', 'forêt', 'chamois', 'nuage', 'froid'] },
  { word: 'musique', related: ['chanson', 'note', 'mélodie', 'rythme', 'guitare', 'piano', 'concert', 'son', 'orchestre', 'voix', 'danse', 'album', 'artiste', 'accord', 'tempo', 'harmonie', 'batterie', 'écouter', 'radio', 'partition'] },
  { word: 'ordinateur', related: ['clavier', 'écran', 'souris', 'internet', 'logiciel', 'processeur', 'mémoire', 'code', 'fichier', 'programme', 'bureau', 'portable', 'données', 'réseau', 'système', 'application', 'serveur', 'disque', 'pixel', 'calcul'] },
  { word: 'cuisine', related: ['plat', 'recette', 'chef', 'four', 'poêle', 'ingrédient', 'goût', 'épice', 'manger', 'assiette', 'couteau', 'légume', 'sauce', 'dessert', 'restaurant', 'saveur', 'mijoter', 'gâteau', 'repas', 'saler'] },
  { word: 'voyage', related: ['avion', 'valise', 'hôtel', 'billet', 'destination', 'aéroport', 'tourisme', 'passeport', 'carte', 'découverte', 'train', 'plage', 'aventure', 'guide', 'séjour', 'départ', 'route', 'monde', 'visiter', 'bagage'] },
  { word: 'jardin', related: ['fleur', 'plante', 'arbre', 'herbe', 'terre', 'graine', 'arroser', 'potager', 'rose', 'feuille', 'racine', 'pelouse', 'insecte', 'abeille', 'tomate', 'pousser', 'nature', 'haie', 'tondre', 'saison'] },
  { word: 'sport', related: ['course', 'ballon', 'équipe', 'match', 'entraînement', 'muscle', 'victoire', 'stade', 'coureur', 'compétition', 'foot', 'tennis', 'effort', 'record', 'médaille', 'endurance', 'joueur', 'arbitre', 'terrain', 'sueur'] },
  { word: 'livre', related: ['page', 'lecture', 'auteur', 'roman', 'histoire', 'chapitre', 'mot', 'bibliothèque', 'papier', 'écrire', 'récit', 'personnage', 'couverture', 'éditeur', 'poésie', 'phrase', 'lire', 'encre', 'titre', 'librairie'] },
  { word: 'espace', related: ['étoile', 'planète', 'galaxie', 'fusée', 'astronaute', 'lune', 'univers', 'orbite', 'satellite', 'cosmos', 'soleil', 'télescope', 'météore', 'nébuleuse', 'gravité', 'mars', 'vide', 'comète', 'astre', 'infini'] },
];

// Similarité de Dice sur bigrammes (0..1) — capture les mots proches en surface.
function diceSimilarity(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = bg(a), B = bg(b); let inter = 0;
  for (const [g, c] of A) if (B.has(g)) inter += Math.min(c, B.get(g));
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

// Renvoie une proximité 0..100 entre `guess` et l'entrée secrète.
export function semanticScore(secretEntry, guess) {
  const g = guess.trim().toLowerCase();
  if (!g) return { score: 0 };
  if (g === secretEntry.word) return { score: 100, win: true };
  const idx = secretEntry.related.indexOf(g);
  if (idx !== -1) {
    // Mot de la liste : proche du sommet -> proche de 100
    const n = secretEntry.related.length;
    const score = Math.round(96 - (idx / n) * 46); // ~96..50 selon le rang
    return { score, rank: idx + 1 };
  }
  // Hors-liste : similarité de surface avec le secret et ses proches, bornée
  let best = diceSimilarity(g, secretEntry.word);
  for (const r of secretEntry.related) best = Math.max(best, diceSimilarity(g, r) * 0.8);
  return { score: Math.round(Math.min(48, best * 100)) };
}

// Mot secret « du jour » déterministe (change chaque jour, identique pour tous).
export function dailySecretIndex(dayStr) {
  let h = 0; for (const c of dayStr) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % SECRET_WORDS.length;
}

/* ---------------- Quiz ---------------- */
export const QUIZ = [
  { q: 'Quelle est la capitale de l\u2019Australie ?', a: ['Sydney', 'Canberra', 'Melbourne', 'Perth'], c: 1, cat: 'Géographie' },
  { q: 'Combien de côtés a un hexagone ?', a: ['5', '6', '7', '8'], c: 1, cat: 'Maths' },
  { q: 'Quel est le plus grand océan du monde ?', a: ['Atlantique', 'Indien', 'Pacifique', 'Arctique'], c: 2, cat: 'Géographie' },
  { q: 'En quelle année a eu lieu le premier pas sur la Lune ?', a: ['1965', '1969', '1972', '1959'], c: 1, cat: 'Histoire' },
  { q: 'Quel gaz les plantes absorbent-elles principalement ?', a: ['Oxygène', 'Azote', 'Dioxyde de carbone', 'Hydrogène'], c: 2, cat: 'Sciences' },
  { q: 'Quelle planète est la plus proche du Soleil ?', a: ['Vénus', 'Mars', 'Mercure', 'Terre'], c: 2, cat: 'Sciences' },
  { q: 'Combien de continents y a-t-il sur Terre ?', a: ['5', '6', '7', '8'], c: 2, cat: 'Géographie' },
  { q: 'Quel est l\u2019animal terrestre le plus rapide ?', a: ['Lion', 'Guépard', 'Antilope', 'Cheval'], c: 1, cat: 'Nature' },
  { q: 'Quel métal est liquide à température ambiante ?', a: ['Fer', 'Mercure', 'Plomb', 'Or'], c: 1, cat: 'Sciences' },
  { q: 'Combien de touches possède un piano standard ?', a: ['76', '82', '88', '92'], c: 2, cat: 'Culture' },
  { q: 'Quelle est la monnaie du Japon ?', a: ['Won', 'Yuan', 'Yen', 'Ringgit'], c: 2, cat: 'Culture' },
  { q: 'Quel organe pompe le sang dans le corps ?', a: ['Foie', 'Cœur', 'Poumon', 'Rein'], c: 1, cat: 'Sciences' },
  { q: 'Quel est le plus long fleuve du monde ?', a: ['Amazone', 'Nil', 'Yangtsé', 'Mississippi'], c: 1, cat: 'Géographie' },
  { q: 'Combien font 7 × 8 ?', a: ['54', '56', '58', '64'], c: 1, cat: 'Maths' },
  { q: 'Quelle langue compte le plus de locuteurs natifs ?', a: ['Anglais', 'Espagnol', 'Mandarin', 'Hindi'], c: 2, cat: 'Culture' },
  { q: 'De quelle couleur est un saphir typique ?', a: ['Rouge', 'Bleu', 'Vert', 'Jaune'], c: 1, cat: 'Nature' },
  { q: 'Quel scientifique a proposé la théorie de la relativité ?', a: ['Newton', 'Einstein', 'Galilée', 'Bohr'], c: 1, cat: 'Sciences' },
  { q: 'Quel est le plus petit nombre premier ?', a: ['0', '1', '2', '3'], c: 2, cat: 'Maths' },
  { q: 'Combien de joueurs dans une équipe de football sur le terrain ?', a: ['9', '10', '11', '12'], c: 2, cat: 'Sport' },
  { q: 'Quel pays a la forme d\u2019une botte ?', a: ['Espagne', 'Grèce', 'Italie', 'Portugal'], c: 2, cat: 'Géographie' },
];

/* ---------------- Anagrammes (mot mélangé) ---------------- */
export const ANAGRAM_WORDS = [
  'ordinateur', 'montagne', 'chocolat', 'bibliotheque', 'aventure', 'symphonie', 'papillon', 'horizon',
  'galaxie', 'labyrinthe', 'fromage', 'parapluie', 'triangle', 'bicyclette', 'dinosaure', 'orchestre',
  'lumiere', 'fenetre', 'jardinier', 'telephone', 'nuage', 'renard', 'tresor', 'volcan', 'cascade',
];

/* ---------------- Mots / thèmes pour l'Imposteur ---------------- */
export const IMPOSTER_WORDS = [
  { theme: 'Fruits', word: 'Banane' }, { theme: 'Fruits', word: 'Fraise' },
  { theme: 'Animaux', word: 'Éléphant' }, { theme: 'Animaux', word: 'Pingouin' },
  { theme: 'Lieux', word: 'Plage' }, { theme: 'Lieux', word: 'Bibliothèque' },
  { theme: 'Objets', word: 'Parapluie' }, { theme: 'Objets', word: 'Horloge' },
  { theme: 'Sports', word: 'Basketball' }, { theme: 'Sports', word: 'Natation' },
  { theme: 'Nourriture', word: 'Pizza' }, { theme: 'Nourriture', word: 'Sushi' },
  { theme: 'Métiers', word: 'Pompier' }, { theme: 'Métiers', word: 'Astronaute' },
  { theme: 'Nature', word: 'Volcan' }, { theme: 'Nature', word: 'Cascade' },
];
