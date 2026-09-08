# 🎮 PLAYROOM

Plateforme de mini-jeux en ligne. 28 jeux : 9 solo + 5 multijoueur à plusieurs (Imposteur, Draw & Guess, Party, Bluff, Caption Battle) + 11 duels 1 contre 1 (Morpion, Puissance 4, Pierre-Feuille-Ciseaux, Duel de Réflexe, Duel de Calcul, Quiz Duel, Course de Frappe, Bâtonnets, Duel de Mémoire, Petits Carrés, Tu préfères ?, Deviner le Nombre, Deviner le Mot, Compatibilité — dont une catégorie Duo/Couple). Système d'amis (statut en ligne + invitations), messagerie directe entre amis en temps réel, profil personnalisable (nom affiché, bio, couleur d'accent, avatar), modération (blocage/signalement), Saisons, comptes, XP, niveaux, titres, succès, classements et défi quotidien. Design premium : fond immersif animé, cartes à ambiance, transitions, confettis, podiums.

## Stack
- **Front** : React 18 + Vite + Tailwind + React Router + lucide-react + socket.io-client
- **Back** : Node 20 + Express + better-sqlite3 + Socket.IO + JWT (cookie httpOnly) + bcrypt
- **Un seul service** : Express sert le build Vite (`dist/`) et gère l'API + les WebSockets.

## Lancer en local
```bash
npm install          # installe et build automatiquement (postinstall)
npm start            # démarre le serveur sur http://localhost:3001
```
Pour le développement avec rechargement à chaud :
```bash
# terminal 1 : API
node server/index.js
# terminal 2 : front (proxy /api + /socket.io vers :3001)
npm run dev
```

## Déploiement sur Railway
1. Pousse ce dossier sur GitHub.
2. Sur Railway : **New Project → Deploy from GitHub repo**.
3. Variables d'environnement :
   - `SESSION_SECRET` = une longue chaîne aléatoire (obligatoire).
   - `APP_URL` = l'URL publique en https (ex : `https://playroom.up.railway.app`) — active les cookies sécurisés.
   - `DATA_DIR` = `/data` (voir ci-dessous).
4. **Persistance de la base** : ajoute un **Volume** Railway monté sur `/data`, et mets `DATA_DIR=/data`.
   Sans volume, la base SQLite est réinitialisée à chaque redéploiement.
5. Railway détecte Node, lance `npm install` (qui build le front) puis `npm start`.

## Ajouter un nouveau jeu
1. Ajoute une entrée dans `src/games/registry.js`.
2. Crée le composant dans `src/games/<id>/`.
3. (Optionnel) ajoute son barème d'XP dans `server/index.js` (`XP_TABLE`).

## Système d'amis
- Ajout d'amis par pseudo (recherche), demandes envoyées/reçues (accepter/refuser).
- **Statut en ligne** et **activité en temps réel** ("En ligne", "Dans un salon", "Joue à …").
- **Invitation directe dans ton salon** : depuis le lobby ou la page Amis ; l'ami reçoit une notification "Rejoindre".
- Présence liée au compte via le cookie JWT du socket (multi-onglets gérés).

## Profils publics & social
- Page profil public de chaque joueur (avatar, nom, bio, niveau, stats, succès), accessible en cliquant sur un joueur (amis, classements).
- Amis en favoris (⭐, épinglés en haut de la liste).
- Messagerie directe entre amis en temps réel.

## Duo
- Carte souvenir partageable en fin de partie à deux (image PNG téléchargeable/partageable) pour Compatibilité et Tu préfères.
- Streak à deux : compteur de jours consécutifs joués ensemble, affiché en fin de partie et sur le profil public d'un ami.
- Compatibilité enrichie de questions style couple (mignonnes et correctes).

## Crush secret & flirt
- Crush secret réciproque : sur le profil d'un ami, un bouton discret « J'ai un crush ». Ça reste 100% secret et ne se révèle QUE si l'autre a craqué aussi (révélation simultanée + notification temps réel). Aucune fuite possible dans le cas contraire.
- Compatibilité : sélecteur d'ambiance Mignon / Flirt / Mix (le mode Flirt propose des questions plus taquines mais correctes).
