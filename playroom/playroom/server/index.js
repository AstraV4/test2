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
} from './db.js';
import { COOKIE, setAuthCookie, clearAuthCookie, userIdFromReq, requireAuth } from './auth.js';
import { RoomManager } from './rooms.js';
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
const rooms = new RoomManager(io);

io.on('connection', (socket) => {
  socket.on('room:create', (d) => rooms.createRoom(socket, d || {}));
  socket.on('room:join', (d) => rooms.joinRoom(socket, d || {}));
  socket.on('room:ready', (d) => rooms.setReady(socket, d?.ready));
  socket.on('room:settings', (d) => rooms.updateSettings(socket, d || {}));
  socket.on('room:kick', (d) => rooms.kick(socket, d?.playerId));
  socket.on('room:leave', () => rooms.leaveRoom(socket));
  socket.on('game:start', () => rooms.startGame(socket));
  socket.on('game:clue', (d) => rooms.submitClue(socket, d?.text));
  socket.on('game:skipVote', () => rooms.skipToVote(socket));
  socket.on('game:vote', (d) => rooms.castVote(socket, d?.targetId));
  socket.on('game:next', () => rooms.nextRound(socket));
  socket.on('game:lobby', () => rooms.backToLobby(socket));
  socket.on('disconnect', () => rooms.handleDisconnect(socket));
});

server.listen(PORT, () => console.log(`PLAYROOM prêt sur :${PORT}`));
