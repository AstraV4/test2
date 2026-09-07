import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'playroom.db'));
db.pragma('journal_mode = WAL');

const now = () => Date.now();

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL,
    email      TEXT UNIQUE,
    pass_hash  TEXT NOT NULL,
    avatar     TEXT NOT NULL DEFAULT 'nebula',
    xp         INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    game       TEXT NOT NULL,
    score      INTEGER NOT NULL,
    meta       TEXT,
    day        TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game, score DESC);
  CREATE INDEX IF NOT EXISTS idx_scores_user ON scores(user_id);
  CREATE TABLE IF NOT EXISTS achievements (
    user_id    INTEGER NOT NULL,
    code       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, code)
  );
  CREATE TABLE IF NOT EXISTS play_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    game       TEXT NOT NULL,
    won        INTEGER NOT NULL DEFAULT 0,
    day        TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

const dayKey = (ts = now()) => new Date(ts).toISOString().slice(0, 10);

/* ---------------- Utilisateurs ---------------- */
export const findUserByName = db.prepare('SELECT * FROM users WHERE username = ?');
export const findUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const _findById = db.prepare('SELECT * FROM users WHERE id = ?');
export const findUserById = (id) => _findById.get(id);
const _createUser = db.prepare('INSERT INTO users (username, email, pass_hash, avatar, created_at) VALUES (?, ?, ?, ?, ?)');
export function createUser({ username, email, passHash, avatar }) {
  const info = _createUser.run(username, email || null, passHash, avatar || 'nebula', now());
  return findUserById(info.lastInsertRowid);
}
const _setAvatar = db.prepare('UPDATE users SET avatar = ? WHERE id = ?');
export const setAvatar = (id, avatar) => _setAvatar.run(avatar, id);
const _addXp = db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?');
export const addXp = (id, amount) => _addXp.run(Math.max(0, Math.round(amount)), id);

// Niveau à partir de l'XP (courbe douce)
export function levelFromXp(xp) {
  let lvl = 1, need = 100, total = 0;
  while (xp >= total + need) { total += need; lvl++; need = Math.round(need * 1.18); }
  return { level: lvl, into: xp - total, need, xp };
}

export function publicUser(u) {
  if (!u) return null;
  const lv = levelFromXp(u.xp);
  return { id: u.id, username: u.username, avatar: u.avatar, xp: u.xp, level: lv.level, levelInfo: lv };
}

/* ---------------- Scores / XP / stats ---------------- */
const _insertScore = db.prepare('INSERT INTO scores (user_id, game, score, meta, day, created_at) VALUES (?, ?, ?, ?, ?, ?)');
const _insertPlay = db.prepare('INSERT INTO play_events (user_id, game, won, day, created_at) VALUES (?, ?, ?, ?, ?)');
export function recordScore(userId, game, score, { meta = null, won = false } = {}) {
  const ts = now();
  _insertScore.run(userId, game, Math.round(score), meta ? JSON.stringify(meta) : null, dayKey(ts), ts);
  _insertPlay.run(userId, game, won ? 1 : 0, dayKey(ts), ts);
}

const _bestScore = db.prepare('SELECT MAX(score) n FROM scores WHERE user_id = ? AND game = ?');
export const bestScore = (userId, game) => _bestScore.get(userId, game)?.n ?? null;

const _userStats = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM play_events WHERE user_id = ?) AS played,
    (SELECT COUNT(*) FROM play_events WHERE user_id = ? AND won = 1) AS wins
`);
const _perGame = db.prepare(`
  SELECT game, COUNT(*) played, MAX(score) best
  FROM scores WHERE user_id = ? GROUP BY game
`);
export function userStats(userId) {
  const s = _userStats.get(userId, userId);
  const perGame = _perGame.all(userId);
  return { played: s.played || 0, wins: s.wins || 0, perGame };
}

/* ---------------- Classements ---------------- */
// period: 'all' | 'day' | 'week'
export function leaderboard(game, period = 'all', limit = 50) {
  let where = 'WHERE s.game = @game';
  const params = { game, limit };
  if (period === 'day') { where += ' AND s.day = @day'; params.day = dayKey(); }
  else if (period === 'week') { where += ' AND s.created_at >= @since'; params.since = now() - 7 * 864e5; }
  // meilleur score par joueur pour ce jeu/période
  const rows = db.prepare(`
    SELECT u.id AS userId, u.username, u.avatar, u.xp, MAX(s.score) AS score
    FROM scores s JOIN users u ON u.id = s.user_id
    ${where}
    GROUP BY u.id
    ORDER BY score DESC
    LIMIT @limit
  `).all(params);
  return rows.map((r, i) => ({
    rank: i + 1, userId: r.userId, username: r.username, avatar: r.avatar,
    level: levelFromXp(r.xp).level, score: r.score,
  }));
}

// Classement global par XP (tous jeux confondus)
export function xpLeaderboard(limit = 50) {
  const rows = db.prepare('SELECT id, username, avatar, xp FROM users ORDER BY xp DESC LIMIT ?').all(limit);
  return rows.map((r, i) => ({ rank: i + 1, userId: r.id, username: r.username, avatar: r.avatar, level: levelFromXp(r.xp).level, score: r.xp }));
}

/* ---------------- Succès (achievements) ---------------- */
const _hasAch = db.prepare('SELECT 1 FROM achievements WHERE user_id = ? AND code = ?');
const _addAch = db.prepare('INSERT OR IGNORE INTO achievements (user_id, code, created_at) VALUES (?, ?, ?)');
const _listAch = db.prepare('SELECT code, created_at FROM achievements WHERE user_id = ?');
export const listAchievements = (userId) => _listAch.all(userId);
export function grantAchievement(userId, code) {
  if (_hasAch.get(userId, code)) return false;
  _addAch.run(userId, code, now());
  return true;
}

export default db;
