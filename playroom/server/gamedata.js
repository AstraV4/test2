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
// Regroupés par thème pour permettre au salon de choisir un thème précis.
export const IMPOSTER_THEMES = {
  'Animaux': ['Éléphant', 'Pingouin', 'Girafe', 'Dauphin', 'Kangourou', 'Hérisson', 'Panda', 'Crocodile'],
  'Nourriture': ['Pizza', 'Sushi', 'Croissant', 'Hamburger', 'Raclette', 'Tacos', 'Crêpe', 'Lasagnes'],
  'Lieux': ['Plage', 'Bibliothèque', 'Aéroport', 'Montagne', 'Musée', 'Marché', 'Stade', 'Château'],
  'Objets': ['Parapluie', 'Horloge', 'Aspirateur', 'Boussole', 'Lampe', 'Ciseaux', 'Valise', 'Télescope'],
  'Sports': ['Basketball', 'Natation', 'Escalade', 'Tennis', 'Ski', 'Boxe', 'Surf', 'Judo'],
  'Métiers': ['Pompier', 'Astronaute', 'Cuisinier', 'Vétérinaire', 'Architecte', 'Jardinier', 'Pilote', 'Magicien'],
  'Nature': ['Volcan', 'Cascade', 'Arc-en-ciel', 'Forêt', 'Désert', 'Glacier', 'Tempête', 'Rivière'],
  'Films & séries': ['Titanic', 'Star Wars', 'Harry Potter', 'Le Roi Lion', 'Jurassic Park', 'Avatar', 'Batman', 'Shrek'],
};
export const IMPOSTER_THEME_LIST = Object.keys(IMPOSTER_THEMES);

// Choisit { theme, word } — thème imposé si fourni et valide, sinon aléatoire.
export function pickImposterWord(theme) {
  const t = IMPOSTER_THEMES[theme] ? theme : IMPOSTER_THEME_LIST[Math.floor(Math.random() * IMPOSTER_THEME_LIST.length)];
  const words = IMPOSTER_THEMES[t];
  return { theme: t, word: words[Math.floor(Math.random() * words.length)] };
}

/* ---------------- Mots à dessiner (Draw & Guess) ---------------- */
// Mots simples et concrets, faciles à dessiner et à deviner.
export const DRAW_WORDS = [
  'chat', 'maison', 'soleil', 'arbre', 'voiture', 'fleur', 'poisson', 'étoile',
  'bateau', 'montagne', 'pomme', 'clé', 'parapluie', 'lune', 'guitare', 'robot',
  'fusée', 'château', 'pizza', 'ballon', 'chapeau', 'lunettes', 'horloge', 'cactus',
  'papillon', 'échelle', 'ananas', 'fantôme', 'dinosaure', 'crayon', 'nuage', 'éclair',
  'serpent', 'tortue', 'avion', 'vélo', 'gâteau', 'couronne', 'ancre', 'clé de sol',
];

/* ---------------- Mode Party (jeux à voter) ---------------- */
// Trois formats : 'wyr' (Tu préfères), 'most' (Le plus susceptible de), 'hot' (Hot take).
// Contenu adapté à une bande d'amis / ambiance cours de récré.
export const PARTY_WYR = [
  ['Pouvoir voler', 'Être invisible'],
  ['Ne plus jamais avoir de devoirs', 'Avoir toujours 20/20 sans réviser'],
  ['Vivre sans musique', 'Vivre sans jeux vidéo'],
  ['Pouvoir parler toutes les langues', 'Pouvoir parler aux animaux'],
  ['Avoir un self illimité gratuit', 'Ne plus jamais être en retard'],
  ['Être le plus drôle de la classe', 'Être le plus intelligent'],
  ['Ne plus jamais avoir de bugs', 'Avoir le wifi gratuit partout à vie'],
  ['Pouvoir arrêter le temps', 'Pouvoir revenir dans le passé'],
  ['Manger que du sucré à vie', 'Manger que du salé à vie'],
  ['Être célèbre sur internet', 'Être riche mais inconnu'],
  ['Avoir des vacances toute l\u2019année', 'Ne jamais tomber malade'],
  ['Lire dans les pensées', 'Voir le futur'],
  ['Ne plus jamais dormir (sans être fatigué)', 'Dormir autant que tu veux'],
  ['Être champion de sport', 'Être une star de la musique'],
  ['Pouvoir te téléporter', 'Avoir une voiture qui vole'],
  ['Perdre tous tes messages', 'Perdre toutes tes photos'],
  ['Rire à chaque fois que tu mens', 'Dire toujours la vérité'],
  ['Avoir un pouvoir mais ridicule', 'N\u2019avoir aucun pouvoir'],
  ['Être prof pour un jour', 'Être directeur pour un jour'],
  ['Ne plus jamais utiliser ton tel', 'Ne plus jamais regarder la télé'],
];
export const PARTY_MOST = [
  'arriver en retard en cours',
  'oublier ses devoirs',
  'devenir célèbre un jour',
  'rire pendant un moment sérieux',
  'oublier l\u2019anniversaire d\u2019un ami',
  'survivre à une apocalypse zombie',
  'devenir millionnaire',
  's\u2019endormir en cours',
  'faire une blague au mauvais moment',
  'partir vivre à l\u2019étranger',
  'répondre au prof sans lever la main',
  'oublier son code / mot de passe',
  'gagner à un jeu télévisé',
  'se perdre dans une nouvelle ville',
  'devenir youtubeur / streameur',
  'craquer et manger tout le paquet de gâteaux',
  'dire une bêtise en présentation',
  'aider un ami à 3h du matin',
  'devenir le boss d\u2019une grande entreprise',
  'oublier où il a mis ses affaires',
];
export const PARTY_HOT = [
  'L\u2019ananas a sa place sur une pizza.',
  'Les maths sont plus utiles que l\u2019histoire.',
  'Il vaut mieux être en avance qu\u2019en retard, toujours.',
  'Les films sont meilleurs que les livres.',
  'Le petit-déjeuner est le meilleur repas de la journée.',
  'Les chats sont mieux que les chiens.',
  'Réviser la veille, ça marche très bien.',
  'Le sucré est meilleur que le salé.',
  'Les vacances d\u2019été sont trop longues.',
  'Écouter de la musique aide à mieux travailler.',
  'Les emojis rendent les messages plus clairs.',
  'On devrait pouvoir choisir toutes ses matières.',
  'Le lundi n\u2019est pas si terrible que ça.',
  'Un bon meme vaut mille mots.',
  'Les jeux vidéo sont un vrai sport.',
  'Il faut toujours finir ce qu\u2019on commence.',
  'Le téléphone devrait être autorisé en cours.',
  'La pizza froide du matin, c\u2019est excellent.',
  'Mieux vaut trop dormir que pas assez.',
  'Les séries valent mieux que les films.',
];

// Construit une manche party. players: [{id,name,avatar}] (pour 'most').
export function buildPartyRound(format, usedIdx, players) {
  const pool = format === 'wyr' ? PARTY_WYR : format === 'most' ? PARTY_MOST : PARTY_HOT;
  // choisir un index non utilisé si possible
  let idx = Math.floor(Math.random() * pool.length);
  for (let i = 0; i < pool.length && usedIdx.has(format + ':' + idx); i++) idx = (idx + 1) % pool.length;
  usedIdx.add(format + ':' + idx);
  if (format === 'wyr') return { format, prompt: 'Tu préfères…', options: pool[idx] };
  if (format === 'hot') return { format, prompt: pool[idx], options: ['D\u2019accord', 'Pas d\u2019accord'] };
  // most : options = joueurs
  return { format, prompt: 'Qui est le plus susceptible de ' + pool[idx] + ' ?', options: players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar })) };
}

/* ---------------- Bluff (trouve la vraie réponse) ---------------- */
// Chaque manche : une question à trou. Les joueurs inventent une fausse réponse,
// puis tout le monde doit retrouver LA vraie parmi les intrus.
export const BLUFF_QA = [
  { q: 'Le nom scientifique de la peur des vendredis 13 est la ___', a: 'paraskevidékatriaphobie' },
  { q: 'Un groupe de flamants roses s\u2019appelle une ___', a: 'flamboyance' },
  { q: 'Le cri du cerf s\u2019appelle le ___', a: 'brame' },
  { q: 'La peur des longs mots s\u2019appelle l\u2019hippopotomonstro___', a: 'sesquippedaliophobie' },
  { q: 'Un bébé kangourou s\u2019appelle un ___', a: 'joey' },
  { q: 'Le point sur la lettre « i » s\u2019appelle un ___', a: 'point suscrit' },
  { q: 'La partie dure au bout d\u2019un lacet s\u2019appelle un ___', a: 'aiguillette' },
  { q: 'Un groupe de hiboux s\u2019appelle un ___', a: 'parlement' },
  { q: 'La peur du nombre 666 s\u2019appelle l\u2019hexakosioihexekonta___', a: 'hexaphobie' },
  { q: 'L\u2019espace entre les sourcils s\u2019appelle la ___', a: 'glabelle' },
  { q: 'Le petit creux au-dessus de la lèvre supérieure s\u2019appelle le ___', a: 'philtrum' },
  { q: 'Un groupe de corbeaux s\u2019appelle une ___', a: 'malice' },
  { q: 'La peur d\u2019être sans téléphone s\u2019appelle la ___', a: 'nomophobie' },
  { q: 'Le nom du symbole « # » en typographie est le ___', a: 'croisillon' },
  { q: 'Un bébé lièvre s\u2019appelle un ___', a: 'levraut' },
  { q: 'La science des drapeaux s\u2019appelle la ___', a: 'vexillologie' },
  { q: 'Le bruit d\u2019un verre qui chante quand on frotte le bord s\u2019appelle un chant ___', a: 'cristallin' },
  { q: 'Un groupe de méduses s\u2019appelle un ___', a: 'essaim' },
];

/* ---------------- Caption Battle (meilleure réponse) ---------------- */
// Chaque manche : une situation. Chacun écrit sa réponse la plus drôle, puis on vote.
export const CAPTION_PROMPTS = [
  'La pire excuse pour un devoir non rendu',
  'Ce qu\u2019on ne devrait jamais dire à un prof',
  'Le super-pouvoir le plus inutile',
  'Le pire nom pour un animal de compagnie',
  'Une mauvaise idée de cadeau d\u2019anniversaire',
  'Ce que pense ton chat quand tu pars',
  'La pire chose à dire pendant un silence gênant',
  'Le titre d\u2019un film catastrophe sur ta vie',
  'Une règle absurde à instaurer au collège',
  'La légende parfaite pour une photo ratée',
  'Le pire slogan pour une pub de dentifrice',
  'Ce qu\u2019on trouve au fond d\u2019un sac de cours',
  'Une nouvelle matière scolaire complètement inutile',
  'La pire façon de commencer un exposé',
  'Ce que dirait ton frigo s\u2019il pouvait parler',
  'Le pire pouvoir pour un super-héros de quartier',
  'Une excuse bidon pour quitter une fête',
  'Le nom d\u2019un groupe de musique formé en cours',
];

/* ---------------- « Tu préfères ? » (duo, écrit par les joueurs) ---------------- */
// Suggestions optionnelles proposées au joueur qui écrit (il peut ignorer et écrire les siennes).
export const WYR_SUGGEST = [
  ['les pâtes', 'le riz'], ['la mer', 'la montagne'], ['le sucré', 'le salé'],
  ['être invisible', 'pouvoir voler'], ['le chien', 'le chat'], ['le matin', 'le soir'],
  ['la pizza', 'les burgers'], ['l\u2019été', 'l\u2019hiver'], ['les films', 'les séries'],
  ['le thé', 'le café'], ['la plage', 'la piscine'], ['lire', 'jouer'],
];

/* ---------------- Compatibilité (Duo / Couple) ---------------- */
// Questions mignonnes à répondre en même temps : plus vous répondez pareil, plus l'affinité monte.
export const COUPLE_QUESTIONS = [
  { q: 'Soirée idéale ensemble ?', options: ['Ciné-canapé', 'Sortie dehors', 'Jeux à deux', 'Resto'] },
  { q: 'Plutôt team…', options: ['Sucré', 'Salé'] },
  { q: 'Vacances de rêve ?', options: ['Plage', 'Montagne', 'Ville', 'Road-trip'] },
  { q: 'Un dimanche parfait, c\u2019est…', options: ['Grasse matinée', 'Balade', 'Cuisine', 'Rien faire'] },
  { q: 'Animal de compagnie idéal ?', options: ['Chien', 'Chat', 'Aucun', 'Original'] },
  { q: 'Pour un ciné, on choisit…', options: ['Comédie', 'Action', 'Horreur', 'Animation'] },
  { q: 'Le matin, vous êtes…', options: ['Du matin', 'Du soir'] },
  { q: 'Cadeau qui fait plaisir ?', options: ['Une surprise', 'Une expérience', 'Un objet utile', 'Fait main'] },
  { q: 'Musique en voiture ?', options: ['On chante fort', 'Douce', 'Podcast', 'Silence'] },
  { q: 'Le plus important dans un duo ?', options: ['Rire ensemble', 'Confiance', 'Aventures', 'Douceur'] },
  { q: 'Boisson chaude préférée ?', options: ['Thé', 'Café', 'Chocolat chaud', 'Rien'] },
  { q: 'Un week-end surprise, tu veux…', options: ['Être surpris', 'Tout organiser', 'Décider à deux'] },
  { q: 'Pizza ou sushi ?', options: ['Pizza', 'Sushi'] },
  { q: 'La saison qui vous ressemble ?', options: ['Été', 'Hiver', 'Printemps', 'Automne'] },
  { q: 'Soirée jeux : plutôt…', options: ['Coopératif', 'Compétitif', 'Chill'] },
  // Un peu plus "couple", mais mignon et correct :
  { q: 'Le premier truc qu\u2019on remarque chez quelqu\u2019un ?', options: ['Le sourire', 'Les yeux', 'L\u2019humour', 'La voix'] },
  { q: 'Un rendez-vous parfait, ce serait…', options: ['Un pique-nique', 'Une expo', 'Une soirée jeux', 'Une balade la nuit'] },
  { q: 'Une qualité qui fait craquer ?', options: ['La gentillesse', 'L\u2019humour', 'La complicité', 'La confiance'] },
  { q: 'Ta façon de montrer que tu tiens à quelqu\u2019un ?', options: ['Des petites attentions', 'Passer du temps', 'Des mots', 'Faire rire'] },
  { q: 'Un slow ou une chanson qui bouge ?', options: ['Un slow', 'Une qui bouge'] },
  { q: 'Le petit détail romantique que tu préfères ?', options: ['Un message le matin', 'Tenir la main', 'Un compliment', 'Une surprise'] },
  { q: 'Si on partait à l\u2019aventure demain…', options: ['La mer', 'La forêt', 'Une grande ville', 'Les étoiles'] },
  { q: 'Ce qui rend un moment inoubliable ?', options: ['Un fou rire', 'Une vraie discussion', 'Une première fois', 'Le silence à deux'] },
  { q: 'Le surnom mignon, tu es…', options: ['Pour', 'Contre', 'Ça dépend'] },
];

// Paquet « flirt » : suggestif, taquin, romantique — mais jamais explicite.
export const COUPLE_FLIRT = [
  { q: 'Un premier baiser, ce serait plutôt…', options: ['Sous la pluie', 'Sur un toit la nuit', 'Devant un film', 'À l\u2019improviste'] },
  { q: 'Ce qui te fait craquer en premier ?', options: ['Un regard', 'Un sourire', 'Une voix', 'Le sens de l\u2019humour'] },
  { q: 'Une soirée en tête-à-tête, tu veux…', options: ['Cuisiner à deux', 'Se balader la nuit', 'Rester blottis', 'Danser dans le salon'] },
  { q: 'Le petit geste qui fait fondre ?', options: ['Une main dans les cheveux', 'Un mot dans le cou', 'Une main tenue', 'Un regard qui s\u2019attarde'] },
  { q: 'Ta déclaration idéale, c\u2019est…', options: ['Discrète et sincère', 'Une grande surprise', 'Écrite', 'Dite les yeux dans les yeux'] },
  { q: 'On se rapproche plutôt…', options: ['Doucement', 'Impulsivement', 'Après un fou rire', 'Quand personne ne regarde'] },
  { q: 'Un slow, tu…', options: ['J\u2019adore', 'Je suis timide', 'Seulement avec la bonne personne'] },
  { q: 'Le lieu parfait pour un date romantique ?', options: ['Sous les étoiles', 'Un rooftop', 'Un coin secret', 'Chez soi, cosy'] },
  { q: 'Ce qui rend quelqu\u2019un irrésistible ?', options: ['La confiance', 'La tendresse', 'Le mystère', 'La complicité'] },
  { q: 'Tu préfères qu\u2019on te dise…', options: ['« Tu me plais »', '« Je pense à toi »', '« Tu me manques »', 'Rien, juste un regard'] },
  { q: 'Après un date qui se passe bien, tu…', options: ['Envoies un message direct', 'Attends un peu (pour le style)', 'Proposes de se revoir vite'] },
  { q: 'Le compliment qui te touche le plus ?', options: ['« Tu es magnifique »', '« J\u2019adore ton rire »', '« Je me sens bien avec toi »'] },
];
