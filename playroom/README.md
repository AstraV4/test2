# 🎮 PLAYROOM

Plateforme de mini-jeux en ligne. 19 jeux : 9 solo + 5 multijoueur à plusieurs (Imposteur, Draw & Guess, Party, Bluff, Caption Battle) + 5 duels 1 contre 1 (Morpion, Puissance 4, Pierre-Feuille-Ciseaux, Duel de Réflexe, Duel de Calcul). Chat de salon, système d'amis (statut en ligne + invitations), modération (blocage/signalement), Saisons, comptes, XP, niveaux, titres, succès, classements et défi quotidien. Design premium : fond immersif animé, cartes à ambiance, transitions, confettis, podiums.

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
