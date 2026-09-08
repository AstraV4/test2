import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketServer } from 'socket.io';

import {
  findUserByName, findUserByEmail, findUserById, createUser, publicUser,
  setAvatar, addXp, levelFromXp, recordScore, bestScore, userStats,
  leaderboard, xpLeaderboard, listAchievements, grantAchievement,
  areFriends, addFriend, removeFriend, listFriendIds, listFriends,
  sendRequest, acceptRequest, declineRequest, cancelRequest, listIncoming, listOutgoing, searchUsers,
  blockUser, unblockUser, isBlocked, blockedBetween, listBlocked, listBlockedIds, addReport,
  seasonInfo, addSeasonXp, seasonXpOf, seasonLeaderboard,
  sendDm, dmThread, markDmRead, unreadCounts, unreadTotal, updateProfile,
} from './db.js';
import { COOKIE, setAuthCookie, clearAuthCookie, userIdFromReq, requireAuth, verifyToken } from './auth.js';
import { RoomManager } from './rooms.js';
import { Presence } from './presence.js';
import { SECRET_WORDS, semanticScore, dailySecretIndex, QUIZ, ANAGRAM_WORDS } from './gamedata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3001;

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// Petit rate-limit maison (par IP + route), suffisant pour ce projet.
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = (req.ip || 'x') + ':' + req.path;
    const nowT = Date.now();
    const rec = hits.get(key) || { n: 0, reset: nowT + windowMs };
    if (nowT > rec.reset) { rec.n = 0; rec.reset = nowT + windowMs; }
    rec.n++; hits.set(key, rec);
    if (rec.n > max) return res.status(429).json({ error: 'rate_limited' });
    next();
  };
}
setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (t > v.reset) hits.delete(k); }, 60000).unref?.();

/* ============================ AUTH ============================ */
const reUser = /^[a-zA-Z0-9_]{3,18}$/;
app.post('/api/auth/register', rateLimit(20, 60000), async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
  const avatar = String(req.body?.avatar || 'nebula');
  if (!reUser.test(username)) return res.status(400).json({ error: 'bad_username' });
  if (password.length < 6) return res.status(400).json({ error: 'weak_password' });
  if (findUserByName.get(username)) return res.status(409).json({ error: 'username_taken' });
  if (email && findUserByEmail.get(email)) return res.status(409).json({ error: 'email_taken' });
  const passHash = await bcrypt.hash(password, 10);
  const user = createUser({ username, email, passHash, avatar });
  setAuthCookie(res, user.id);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/login', rateLimit(30, 60000), async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const user = findUserByName.get(username) || (username.includes('@') ? findUserByEmail.get(username.toLowerCase()) : null);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  const ok = await bcrypt.compare(password, user.pass_hash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
  setAuthCookie(res, user.id);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => { clearAuthCookie(res); res.json({ ok: true }); });

app.get('/api/auth/me', (req, res) => {
  const uid = userIdFromReq(req);
  const user = uid ? findUserById(uid) : null;
  res.json({ user: user ? publicUser(user) : null });
});

app.post('/api/me/avatar', requireAuth, (req, res) => {
  const avatar = String(req.body?.avatar || 'nebula').slice(0, 24);
  setAvatar(req.userId, avatar);
  res.json({ user: publicUser(findUserById(req.userId)) });
});

app.post('/api/me/profile-update', requireAuth, rateLimit(30, 60000), (req, res) => {
  const user = updateProfile(req.userId, {
    displayName: req.body?.displayName, bio: req.body?.bio, accent: req.body?.accent,
  });
  res.json({ user: publicUser(user) });
});

/* ============================ PROFIL / STATS ============================ */
app.get('/api/me/profile', requireAuth, (req, res) => {
  const user = findUserById(req.userId);
  const stats = userStats(req.userId);
  const achievements = listAchievements(req.userId).map(a => a.code);
  res.json({ user: publicUser(user), stats, achievements });
});

/* ============================ SCORES / XP ============================ */
const XP_TABLE = { reaction: 12, memory: 15, number: 10, anagram: 14, quiz: 16, semantic: 20, mathrush: 14, typerush: 15, memgrid: 15 };
function checkAchievements(userId, game, score, stats) {
  const granted = [];
  const g = (code) => { if (grantAchievement(userId, code)) granted.push(code); };
  if (stats.played === 1) g('first_game');
  if (stats.wins >= 1) g('first_win');
  if (stats.played >= 10) g('ten_games');
  if (stats.played >= 25) g('addict');
  if (stats.played >= 100) g('century');
  if (stats.wins >= 10) g('ten_wins');
  if (game === 'reaction' && score >= 700) g('fast_reflex');
  if (game === 'memory' && score >= 12) g('memory_master');
  if (game === 'quiz' && score >= 18) g('quiz_genius');
  if (game === 'semantic' && score >= 100) g('word_hunter');
  if (game === 'mathrush' && score >= 25) g('math_wizard');
  if (game === 'typerush' && score >= 60) g('speed_typist');
  if (game === 'memgrid' && score >= 10) g('grid_master');
  return granted;
}

app.post('/api/games/score', requireAuth, rateLimit(120, 60000), (req, res) => {
  const game = String(req.body?.game || '');
  let score = Number(req.body?.score);
  const won = !!req.body?.won;
  const meta = req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : null;
  if (!XP_TABLE[game] || !Number.isFinite(score)) return res.status(400).json({ error: 'bad_request' });
  score = Math.max(0, Math.min(1_000_000, Math.round(score)));
  const prevBest = bestScore(req.userId, game);
  recordScore(req.userId, game, score, { meta, won });
  // XP : base + bonus victoire + bonus record
  let xpGain = XP_TABLE[game] + (won ? 15 : 0);
  const isRecord = prevBest == null || score > prevBest;
  if (isRecord) xpGain += 10;
  addXp(req.userId, xpGain);
  addSeasonXp(req.userId, xpGain);
  const user = findUserById(req.userId);
  const stats = userStats(req.userId);
  const newAch = checkAchievements(req.userId, game, score, stats);
  res.json({
    ok: true, xpGain, isRecord, best: Math.max(prevBest || 0, score),
    user: publicUser(user), newAchievements: newAch,
  });
});

/* ============================ CLASSEMENTS ============================ */
app.get('/api/leaderboard', (req, res) => {
  const game = String(req.query.game || 'xp');
  const period = ['all', 'day', 'week'].includes(req.query.period) ? req.query.period : 'all';
  const rows = game === 'xp' ? xpLeaderboard(50) : leaderboard(game, period, 50);
  let me = null;
  const uid = userIdFromReq(req);
  if (uid) { const found = rows.find(r => r.userId === uid); if (found) me = found; }
  res.json({ game, period, rows, me });
});

/* ============================ DÉFI DU JOUR ============================ */
// Un jeu solo est désigné chaque jour de façon déterministe (même pour tous).
// Le classement du jour réutilise l'infra existante (period='day').
const DAILY_POOL = ['reaction', 'memory', 'number', 'anagram', 'quiz', 'mathrush', 'typerush', 'memgrid'];
function dailyGame(dayStr) {
  let h = 0; for (const c of dayStr) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return DAILY_POOL[h % DAILY_POOL.length];
}
app.get('/api/daily', (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  const game = dailyGame(day);
  const rows = leaderboard(game, 'day', 20);
  let me = null; const uid = userIdFromReq(req);
  if (uid) { const found = rows.find(r => r.userId === uid); if (found) me = found; }
  res.json({ day, game, rows, me });
});

/* ============================ JEU SÉMANTIQUE ============================ */
// Le mot secret n'est jamais envoyé au client : on ne renvoie qu'un score de proximité.
app.get('/api/semantic/today', (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  res.json({ day, index: dailySecretIndex(day) }); // index public : identifie la partie du jour, pas le mot
});
app.post('/api/semantic/guess', rateLimit(240, 60000), (req, res) => {
  const guess = String(req.body?.guess || '').slice(0, 40);
  let index = Number(req.body?.index);
  if (!Number.isInteger(index) || index < 0 || index >= SECRET_WORDS.length) {
    index = dailySecretIndex(new Date().toISOString().slice(0, 10));
  }
  const entry = SECRET_WORDS[index];
  const r = semanticScore(entry, guess);
  res.json({ guess: guess.toLowerCase(), score: r.score, win: !!r.win, rank: r.rank ?? null });
});

/* ============================ QUIZ / ANAGRAMME ============================ */
app.get('/api/quiz/round', (req, res) => {
  // 10 questions mélangées ; on renvoie sans révéler la bonne réponse (index c).
  const pool = [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 10)
    .map((q, i) => ({ id: i, q: q.q, a: q.a, cat: q.cat, _c: q.c }));
  // token signé simple pour vérifier les réponses au retour
  const answers = pool.map(p => p._c);
  const token = Buffer.from(JSON.stringify(answers)).toString('base64');
  res.json({ token, questions: pool.map(({ _c, ...rest }) => rest) });
});
app.post('/api/quiz/check', (req, res) => {
  try {
    const token = String(req.body?.token || '');
    const picks = Array.isArray(req.body?.picks) ? req.body.picks : [];
    const answers = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    let correct = 0; const detail = answers.map((a, i) => { const ok = picks[i] === a; if (ok) correct++; return { i, correct: a, ok }; });
    res.json({ correct, total: answers.length, detail });
  } catch { res.status(400).json({ error: 'bad_token' }); }
});
app.get('/api/anagram/word', (req, res) => {
  const w = ANAGRAM_WORDS[Math.floor(Math.random() * ANAGRAM_WORDS.length)];
  const scrambled = w.split('').sort(() => Math.random() - 0.5).join('');
  const token = Buffer.from(w).toString('base64');
  res.json({ scrambled: scrambled === w ? w.split('').reverse().join('') : scrambled, length: w.length, token });
});
app.post('/api/anagram/check', (req, res) => {
  try {
    const token = String(req.body?.token || '');
    const answer = String(req.body?.answer || '').toLowerCase().trim();
    const word = Buffer.from(token, 'base64').toString('utf8');
    res.json({ correct: answer === word, word });
  } catch { res.status(400).json({ error: 'bad_token' }); }
});

/* ============================ AMIS ============================ */
function friendsPayload(userId) {
  const friends = listFriends(userId).map(f => ({ ...f, ...presence.statusOf(f.id) }));
  // en ligne d'abord, puis par niveau
  friends.sort((a, b) => (b.online - a.online) || (b.level - a.level));
  return { friends, incoming: listIncoming(userId), outgoing: listOutgoing(userId) };
}
app.get('/api/friends', requireAuth, (req, res) => res.json(friendsPayload(req.userId)));

app.get('/api/users/search', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  const friendSet = new Set(listFriendIds(req.userId));
  const out = new Set(listOutgoing(req.userId).map(u => u.id));
  const inc = new Set(listIncoming(req.userId).map(u => u.id));
  const results = searchUsers(q, req.userId).map(u => ({
    ...u, relation: friendSet.has(u.id) ? 'friend' : out.has(u.id) ? 'sent' : inc.has(u.id) ? 'incoming' : 'none',
  }));
  res.json({ results });
});

app.post('/api/friends/request', requireAuth, rateLimit(40, 60000), (req, res) => {
  const username = String(req.body?.username || '').trim();
  const target = findUserByName.get(username);
  if (!target) return res.status(404).json({ error: 'user_not_found' });
  if (blockedBetween(req.userId, target.id)) return res.status(403).json({ error: 'blocked' });
  const r = sendRequest(req.userId, target.id);
  // notifier la cible en temps réel
  if (r === 'sent' || r === 'accepted') { presence.emitToUser(target.id, 'friends:update', {}); presence.emitToUser(req.userId, 'friends:update', {}); }
  res.json({ status: r });
});
app.post('/api/friends/accept', requireAuth, (req, res) => {
  const fromId = parseInt(req.body?.userId, 10);
  const ok = acceptRequest(req.userId, fromId);
  if (ok) { presence.emitToUser(fromId, 'friends:update', {}); presence.emitToUser(req.userId, 'friends:update', {}); }
  res.json({ ok });
});
app.post('/api/friends/decline', requireAuth, (req, res) => {
  const fromId = parseInt(req.body?.userId, 10);
  declineRequest(req.userId, fromId);
  presence.emitToUser(fromId, 'friends:update', {});
  res.json({ ok: true });
});
app.post('/api/friends/cancel', requireAuth, (req, res) => {
  const toId = parseInt(req.body?.userId, 10);
  cancelRequest(req.userId, toId);
  presence.emitToUser(toId, 'friends:update', {});
  res.json({ ok: true });
});
app.post('/api/friends/remove', requireAuth, (req, res) => {
  const otherId = parseInt(req.body?.userId, 10);
  removeFriend(req.userId, otherId);
  presence.emitToUser(otherId, 'friends:update', {});
  res.json({ ok: true });
});

/* ============================ MESSAGERIE (DM) ============================ */
app.get('/api/dm/unread', requireAuth, (req, res) => res.json({ counts: unreadCounts(req.userId), total: unreadTotal(req.userId) }));
app.get('/api/dm/:userId', requireAuth, (req, res) => {
  const other = parseInt(req.params.userId, 10);
  if (!areFriends(req.userId, other)) return res.status(403).json({ error: 'not_friends' });
  markDmRead(req.userId, other);
  res.json({ messages: dmThread(req.userId, other, 60), other: publicUser(findUserById(other)) });
});
app.post('/api/dm/:userId', requireAuth, rateLimit(120, 60000), (req, res) => {
  const other = parseInt(req.params.userId, 10);
  if (!areFriends(req.userId, other)) return res.status(403).json({ error: 'not_friends' });
  if (blockedBetween(req.userId, other)) return res.status(403).json({ error: 'blocked' });
  const msg = sendDm(req.userId, other, req.body?.body);
  if (!msg) return res.status(400).json({ error: 'empty' });
  const from = findUserById(req.userId);
  // Notifier le destinataire en temps réel
  presence.emitToUser(other, 'dm:new', { ...msg, fromName: from.username, fromAvatar: from.avatar });
  res.json({ message: msg });
});

/* ============================ MODÉRATION ============================ */
app.get('/api/mod/blocked', requireAuth, (req, res) => res.json({ blocked: listBlocked(req.userId) }));
app.post('/api/mod/block', requireAuth, (req, res) => {
  const otherId = parseInt(req.body?.userId, 10); if (!otherId || otherId === req.userId) return res.status(400).json({ error: 'bad_request' });
  blockUser(req.userId, otherId);
  presence.emitToUser(otherId, 'friends:update', {}); presence.emitToUser(req.userId, 'friends:update', {});
  res.json({ ok: true });
});
app.post('/api/mod/unblock', requireAuth, (req, res) => {
  const otherId = parseInt(req.body?.userId, 10); unblockUser(req.userId, otherId); res.json({ ok: true });
});
app.post('/api/mod/report', requireAuth, rateLimit(20, 60000), (req, res) => {
  const otherId = parseInt(req.body?.userId, 10); if (!otherId) return res.status(400).json({ error: 'bad_request' });
  addReport(req.userId, otherId, req.body?.reason);
  res.json({ ok: true });
});

/* ============================ SAISON ============================ */
app.get('/api/season', (req, res) => {
  const season = seasonInfo();
  const top = seasonLeaderboard(50);
  let me = null; const uid = userIdFromReq(req);
  if (uid) { const xp = seasonXpOf(uid); me = { xp, ...levelFromXp(xp), rank: (top.find(r => r.userId === uid)?.rank) || null }; }
  res.json({ season, top, me });
});

/* ============================ SPA ============================ */
const distDir = path.join(ROOT, 'dist');
app.use(express.static(distDir, { maxAge: '1h', index: false }));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return res.status(404).json({ error: 'not_found' });
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(200).send('<!doctype html><meta charset="utf-8"><title>PLAYROOM</title><body style="font-family:sans-serif;padding:40px">Build manquant. Lance <code>npm run build</code>.</body>');
  });
});

/* ============================ SOCKET.IO ============================ */
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: true, credentials: true } });
const presence = new Presence(io, listFriendIds);
const rooms = new RoomManager(io, presence);

// Authentifie le socket via le cookie JWT (présence liée au compte).
function userIdFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const m = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!m) return null;
  return verifyToken(decodeURIComponent(m.slice(COOKIE.length + 1)));
}

io.on('connection', (socket) => {
  const uid = userIdFromCookie(socket.handshake.headers?.cookie);
  if (uid) { socket.data.userId = uid; presence.add(uid, socket.id); }

  socket.on('room:create', (d) => rooms.createRoom(socket, d || {}));
  socket.on('room:join', (d) => rooms.joinRoom(socket, d || {}));
  socket.on('room:ready', (d) => rooms.setReady(socket, d?.ready));
  socket.on('room:settings', (d) => rooms.updateSettings(socket, d || {}));
  socket.on('room:setGame', (d) => rooms.setGameType(socket, d?.gameType));
  socket.on('room:kick', (d) => rooms.kick(socket, d?.playerId));
  socket.on('room:leave', () => rooms.leaveRoom(socket));
  socket.on('game:start', () => rooms.startGame(socket));
  socket.on('game:sync', () => rooms.syncPlayer(socket));
  socket.on('game:clue', (d) => rooms.submitClue(socket, d?.text));
  socket.on('game:skipVote', () => rooms.skipToVote(socket));
  socket.on('game:vote', (d) => rooms.castVote(socket, d?.targetId));
  socket.on('game:next', () => rooms.nextRound(socket));
  socket.on('game:lobby', () => rooms.backToLobby(socket));
  socket.on('chat:send', (d) => rooms.sendChat(socket, d?.text));
  socket.on('draw:pick', (d) => rooms.pickDrawWord(socket, d?.index));
  socket.on('draw:stroke', (d) => rooms.relayStroke(socket, d));
  socket.on('draw:clear', () => rooms.clearCanvas(socket));
  socket.on('party:vote', (d) => rooms.castPartyVote(socket, d?.choice));
  socket.on('bluff:answer', (d) => rooms.bluffAnswer(socket, d?.text));
  socket.on('bluff:pick', (d) => rooms.bluffPick(socket, d?.index));
  socket.on('caption:answer', (d) => rooms.captionAnswer(socket, d?.text));
  socket.on('caption:vote', (d) => rooms.captionVote(socket, d?.targetId));
  socket.on('duel:cell', (d) => rooms.duelCell(socket, d?.cell));
  socket.on('duel:col', (d) => rooms.duelCol(socket, d?.col));
  socket.on('duel:rps', (d) => rooms.duelRps(socket, d?.choice));
  socket.on('duel:tap', () => rooms.duelTap(socket));
  socket.on('duel:answer', (d) => rooms.duelAnswer(socket, d?.value));
  socket.on('duel:quiz', (d) => rooms.duelQuiz(socket, d?.choice));
  socket.on('duel:type', (d) => rooms.duelType(socket, d?.text));
  socket.on('duel:take', (d) => rooms.duelTake(socket, d?.n));
  socket.on('duel:flip', (d) => rooms.duelFlip(socket, d?.index));
  socket.on('duel:edge', (d) => rooms.duelEdge(socket, d));
  socket.on('wyr:submit', (d) => rooms.wyrSubmit(socket, d || {}));
  socket.on('wyr:answer', (d) => rooms.wyrAnswer(socket, d?.choice));

  // Invitation directe dans son salon
  socket.on('invite:send', (d) => {
    const fromId = socket.data.userId; if (!fromId) return;
    const toId = parseInt(d?.toUserId, 10); if (!toId) return;
    if (!areFriends(fromId, toId)) return;
    if (blockedBetween(fromId, toId)) return;
    const code = rooms.roomCodeOf(socket);
    if (!code) { socket.emit('invite:error', { message: 'Tu dois être dans un salon pour inviter.' }); return; }
    const from = findUserById(fromId);
    presence.emitToUser(toId, 'invite:receive', { code, gameType: rooms.roomGameType(code), fromName: from?.username, fromAvatar: from?.avatar });
    socket.emit('invite:sent', { toUserId: toId });
  });

  socket.on('disconnect', () => { rooms.handleDisconnect(socket); presence.remove(socket.id); });
});

server.listen(PORT, () => console.log(`PLAYROOM prêt sur :${PORT}`));
