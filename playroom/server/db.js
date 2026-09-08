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

/* ---------------- Amis ---------------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS friendships (
    u_lo INTEGER NOT NULL,
    u_hi INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (u_lo, u_hi)
  );
  CREATE TABLE IF NOT EXISTS friend_requests (
    from_id INTEGER NOT NULL,
    to_id   INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (from_id, to_id)
  );
`);
const lohi = (a, b) => (a < b ? [a, b] : [b, a]);
const _areFriends = db.prepare('SELECT 1 FROM friendships WHERE u_lo = ? AND u_hi = ?');
export function areFriends(a, b) { const [lo, hi] = lohi(a, b); return !!_areFriends.get(lo, hi); }
const _insFriend = db.prepare('INSERT OR IGNORE INTO friendships (u_lo, u_hi, created_at) VALUES (?, ?, ?)');
const _delReqPair = db.prepare('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)');
export function addFriend(a, b) { const [lo, hi] = lohi(a, b); _insFriend.run(lo, hi, now()); _delReqPair.run(a, b, b, a); }
const _delFriend = db.prepare('DELETE FROM friendships WHERE u_lo = ? AND u_hi = ?');
export function removeFriend(a, b) { const [lo, hi] = lohi(a, b); _delFriend.run(lo, hi); }
const _friendIds = db.prepare('SELECT u_lo, u_hi FROM friendships WHERE u_lo = ? OR u_hi = ?');
export function listFriendIds(userId) { return _friendIds.all(userId, userId).map(r => (r.u_lo === userId ? r.u_hi : r.u_lo)); }
export function listFriends(userId) {
  return listFriendIds(userId).map(id => { const u = findUserById(id); return u ? publicUser(u) : null; }).filter(Boolean);
}
const _insReq = db.prepare('INSERT OR IGNORE INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)');
const _getReq = db.prepare('SELECT 1 FROM friend_requests WHERE from_id = ? AND to_id = ?');
export function sendRequest(fromId, toId) {
  if (fromId === toId) return 'self';
  if (areFriends(fromId, toId)) return 'already';
  if (_getReq.get(toId, fromId)) { addFriend(fromId, toId); return 'accepted'; } // demande réciproque -> amis
  _insReq.run(fromId, toId, now());
  return 'sent';
}
export function acceptRequest(meId, fromId) { if (_getReq.get(fromId, meId)) { addFriend(meId, fromId); return true; } return false; }
const _delReq = db.prepare('DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?');
export function declineRequest(meId, fromId) { _delReq.run(fromId, meId); }
export function cancelRequest(meId, toId) { _delReq.run(meId, toId); }
const _incoming = db.prepare('SELECT from_id, created_at FROM friend_requests WHERE to_id = ? ORDER BY created_at DESC');
const _outgoing = db.prepare('SELECT to_id, created_at FROM friend_requests WHERE from_id = ? ORDER BY created_at DESC');
export function listIncoming(userId) { return _incoming.all(userId).map(r => { const u = findUserById(r.from_id); return u ? publicUser(u) : null; }).filter(Boolean); }
export function listOutgoing(userId) { return _outgoing.all(userId).map(r => { const u = findUserById(r.to_id); return u ? publicUser(u) : null; }).filter(Boolean); }
const _search = db.prepare("SELECT id FROM users WHERE username LIKE ? AND id != ? ORDER BY username LIMIT 10");
export function searchUsers(q, excludeId) {
  return _search.all('%' + String(q).replace(/[%_]/g, '') + '%', excludeId).map(r => publicUser(findUserById(r.id)));
}

/* ---------------- Modération (blocage / signalement) ---------------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS blocks (
    blocker_id INTEGER NOT NULL,
    blocked_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
  );
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL,
    reported_id INTEGER NOT NULL,
    reason TEXT,
    created_at INTEGER NOT NULL
  );
`);
const _block = db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)');
const _unblock = db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?');
const _isBlocked = db.prepare('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?');
export function blockUser(a, b) { _block.run(a, b, now()); removeFriend(a, b); _delReqPair.run(a, b, b, a); }
export function unblockUser(a, b) { _unblock.run(a, b); }
export function isBlocked(a, b) { return !!_isBlocked.get(a, b); }                 // a a bloqué b
export function blockedBetween(a, b) { return isBlocked(a, b) || isBlocked(b, a); } // dans un sens ou l'autre
const _blockedIds = db.prepare('SELECT blocked_id FROM blocks WHERE blocker_id = ?');
export function listBlockedIds(userId) { return _blockedIds.all(userId).map(r => r.blocked_id); }
export function listBlocked(userId) { return listBlockedIds(userId).map(id => { const u = findUserById(id); return u ? publicUser(u) : null; }).filter(Boolean); }
const _addReport = db.prepare('INSERT INTO reports (reporter_id, reported_id, reason, created_at) VALUES (?, ?, ?, ?)');
export function addReport(reporterId, reportedId, reason) { _addReport.run(reporterId, reportedId, String(reason || '').slice(0, 300), now()); }

/* ---------------- Saisons ---------------- */
// Saisons de 4 semaines, calculées à partir d'une date de référence (déterministe).
const SEASON_EPOCH = Date.UTC(2026, 0, 5); // lundi 5 janvier 2026
const SEASON_MS = 28 * 24 * 60 * 60 * 1000;
export function seasonInfo(ts = now()) {
  const n = Math.max(0, Math.floor((ts - SEASON_EPOCH) / SEASON_MS));
  const startsAt = SEASON_EPOCH + n * SEASON_MS;
  return { id: n + 1, name: `Saison ${n + 1}`, startsAt, endsAt: startsAt + SEASON_MS };
}
db.exec(`
  CREATE TABLE IF NOT EXISTS season_scores (
    season_id INTEGER NOT NULL,
    user_id   INTEGER NOT NULL,
    xp        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (season_id, user_id)
  );
`);
const _addSeasonXp = db.prepare(`
  INSERT INTO season_scores (season_id, user_id, xp) VALUES (@s, @u, @x)
  ON CONFLICT(season_id, user_id) DO UPDATE SET xp = xp + @x
`);
export function addSeasonXp(userId, amount) { _addSeasonXp.run({ s: seasonInfo().id, u: userId, x: Math.max(0, Math.round(amount)) }); }
const _seasonXp = db.prepare('SELECT xp FROM season_scores WHERE season_id = ? AND user_id = ?');
export function seasonXpOf(userId) { return _seasonXp.get(seasonInfo().id, userId)?.xp || 0; }
export function seasonLeaderboard(limit = 50) {
  const sid = seasonInfo().id;
  const rows = db.prepare(`
    SELECT u.id, u.username, u.avatar, u.xp AS totalXp, ss.xp AS sxp
    FROM season_scores ss JOIN users u ON u.id = ss.user_id
    WHERE ss.season_id = ? ORDER BY ss.xp DESC LIMIT ?
  `).all(sid, limit);
  return rows.map((r, i) => ({ rank: i + 1, userId: r.id, username: r.username, avatar: r.avatar, level: levelFromXp(r.totalXp).level, score: r.sxp }));
}

export default db;
