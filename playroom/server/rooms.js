import { customAlphabet } from 'nanoid';
import { IMPOSTER_WORDS, DRAW_WORDS } from './gamedata.js';

const genCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

/**
 * Gestion en mémoire des salons multijoueur.
 * Deux jeux : 'imposter' et 'draw' (Draw & Guess).
 * Toute la logique (rôles, phases, votes, mots, scores) est validée ICI, côté
 * serveur. Le client n'émet que des intentions et affiche l'état reçu.
 */
export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();       // code -> room
    this.socketIndex = new Map(); // socketId -> { code, playerId }
  }

  publicRoom(room) {
    const base = {
      code: room.code,
      gameType: room.gameType,
      hostId: room.hostId,
      phase: room.phase,
      settings: room.settings,
      round: room.round,
      players: room.players.map(p => ({
        id: p.id, name: p.name, avatar: p.avatar, ready: p.ready,
        connected: p.connected, isHost: p.id === room.hostId,
        hasVoted: room.phase === 'vote' ? !!room.votes?.[p.id] : undefined,
        eliminated: p.eliminated || false,
        score: room.scores ? (room.scores[p.id] || 0) : undefined,
        isDrawer: room.gameType === 'draw' ? p.id === room.drawerId : undefined,
        hasGuessed: room.gameType === 'draw' && room.guessed ? room.guessed.includes(p.id) : undefined,
      })),
      chatAllowed: this._chatAllowed(room),
    };
    if (room.gameType === 'draw') {
      base.draw = {
        drawerId: room.drawerId || null,
        wordLength: room.word ? room.word.length : null,
        turn: room.turnCount || 0,
        totalTurns: room.totalTurns || 0,
      };
    }
    return base;
  }

  emitRoom(room) { this.io.to(room.code).emit('room:update', this.publicRoom(room)); }

  createRoom(socket, { name, avatar }) {
    let code; do { code = genCode(); } while (this.rooms.has(code));
    const playerId = socket.id;
    const room = {
      code, hostId: playerId, gameType: 'imposter', phase: 'lobby', round: 0,
      settings: { imposters: 1, discussionSec: 90, rounds: 1, drawSec: 75, drawRounds: 1 },
      players: [{ id: playerId, name: sanitizeName(name), avatar: avatar || 'nebula', ready: false, connected: true, socketId: socket.id, lastChat: 0 }],
      votes: {}, roles: {}, clueOrder: [], clueIndex: 0, timer: null,
      scores: null, guessed: null, drawerId: null, word: null,
    };
    this.rooms.set(code, room);
    this._bind(socket, code, playerId);
    socket.emit('room:joined', { code, playerId });
    this.emitRoom(room);
    return room;
  }

  joinRoom(socket, { code, name, avatar }) {
    code = String(code || '').toUpperCase().trim();
    const room = this.rooms.get(code);
    if (!room) return socket.emit('room:error', { message: 'Salon introuvable.' });
    if (room.phase !== 'lobby') return socket.emit('room:error', { message: 'La partie a déjà commencé.' });
    if (room.players.length >= 12) return socket.emit('room:error', { message: 'Salon complet (12 max).' });
    const playerId = socket.id;
    room.players.push({ id: playerId, name: sanitizeName(name), avatar: avatar || 'nebula', ready: false, connected: true, socketId: socket.id, lastChat: 0 });
    this._bind(socket, code, playerId);
    socket.emit('room:joined', { code, playerId });
    this.emitRoom(room);
  }

  _bind(socket, code, playerId) { socket.join(code); this.socketIndex.set(socket.id, { code, playerId }); }
  _room(socket) { const idx = this.socketIndex.get(socket.id); return idx ? (this.rooms.get(idx.code) || null) : null; }
  _me(room, socket) { return room?.players.find(p => p.socketId === socket.id) || null; }
  _isHost(room, socket) { const me = this._me(room, socket); return me && me.id === room.hostId; }

  setGameType(socket, type) {
    const room = this._room(socket); if (!room || !this._isHost(room, socket) || room.phase !== 'lobby') return;
    if (type === 'imposter' || type === 'draw') { room.gameType = type; this.emitRoom(room); }
  }

  setReady(socket, ready) {
    const room = this._room(socket); if (!room) return;
    const me = this._me(room, socket); if (!me) return;
    me.ready = !!ready; this.emitRoom(room);
  }

  updateSettings(socket, settings) {
    const room = this._room(socket); if (!room || !this._isHost(room, socket)) return;
    const s = room.settings;
    if (settings.imposters != null) s.imposters = clamp(parseInt(settings.imposters, 10) || s.imposters, 1, Math.max(1, Math.floor(room.players.length / 3)));
    if (settings.discussionSec != null) s.discussionSec = clamp(parseInt(settings.discussionSec, 10) || s.discussionSec, 30, 300);
    if (settings.rounds != null) s.rounds = clamp(parseInt(settings.rounds, 10) || s.rounds, 1, 5);
    if (settings.drawSec != null) s.drawSec = clamp(parseInt(settings.drawSec, 10) || s.drawSec, 40, 150);
    if (settings.drawRounds != null) s.drawRounds = clamp(parseInt(settings.drawRounds, 10) || s.drawRounds, 1, 3);
    this.emitRoom(room);
  }

  kick(socket, playerId) {
    const room = this._room(socket); if (!room || !this._isHost(room, socket)) return;
    if (playerId === room.hostId) return;
    const p = room.players.find(x => x.id === playerId);
    room.players = room.players.filter(x => x.id !== playerId);
    if (p) { this.io.to(p.socketId).emit('room:kicked'); const s = this.io.sockets.sockets.get(p.socketId); if (s) { s.leave(room.code); this.socketIndex.delete(s.id); } }
    this.emitRoom(room);
  }

  startGame(socket) {
    const room = this._room(socket); if (!room || !this._isHost(room, socket)) return;
    if (room.players.length < 3) return socket.emit('room:error', { message: 'Il faut au moins 3 joueurs.' });
    if (room.gameType === 'draw') this._beginDraw(room);
    else this._beginRound(room);
  }

  /* ============================ IMPOSTEUR ============================ */
  _beginRound(room) {
    room.round += 1;
    room.votes = {}; room.roles = {}; room.clueIndex = 0;
    room.players.forEach(p => { p.eliminated = false; });
    const pick = IMPOSTER_WORDS[Math.floor(Math.random() * IMPOSTER_WORDS.length)];
    room.secret = pick;
    const ids = room.players.map(p => p.id);
    shuffle(ids);
    const impCount = clamp(room.settings.imposters, 1, Math.max(1, Math.floor(ids.length / 3)));
    const imposters = new Set(ids.slice(0, impCount));
    room.players.forEach(p => { room.roles[p.id] = imposters.has(p.id) ? 'imposter' : 'crew'; });
    room.clueOrder = shuffle([...ids]);
    room.phase = 'reveal';
    room.players.forEach(p => {
      const role = room.roles[p.id];
      this.io.to(p.socketId).emit('game:role', { role, theme: pick.theme, word: role === 'imposter' ? null : pick.word });
    });
    this.emitRoom(room);
    this._setTimer(room, 6000, () => this._startClues(room));
  }
  _startClues(room) { room.phase = 'clues'; room.clueIndex = 0; this.emitRoom(room); this._promptClue(room); }
  _promptClue(room) {
    const activeOrder = room.clueOrder.filter(id => room.players.some(p => p.id === id));
    if (room.clueIndex >= activeOrder.length) { this._startDiscussion(room); return; }
    const currentId = activeOrder[room.clueIndex];
    this.io.to(room.code).emit('game:clueTurn', { currentId, index: room.clueIndex, total: activeOrder.length });
    this._setTimer(room, 20000, () => { room.clueIndex++; this._promptClue(room); });
  }
  submitClue(socket, text) {
    const room = this._room(socket); if (!room || room.phase !== 'clues') return;
    const me = this._me(room, socket); if (!me) return;
    const activeOrder = room.clueOrder.filter(id => room.players.some(p => p.id === id));
    if (activeOrder[room.clueIndex] !== me.id) return;
    const clue = sanitizeClue(text);
    this.io.to(room.code).emit('game:clue', { playerId: me.id, name: me.name, clue });
    room.clueIndex++;
    this._promptClue(room);
  }
  _startDiscussion(room) { room.phase = 'discussion'; this.emitRoom(room); this._setTimer(room, room.settings.discussionSec * 1000, () => this._startVote(room)); }
  skipToVote(socket) { const room = this._room(socket); if (!room || !this._isHost(room, socket)) return; if (room.phase === 'discussion') this._startVote(room); }
  _startVote(room) { room.phase = 'vote'; room.votes = {}; this.emitRoom(room); this._setTimer(room, 45000, () => this._resolveVotes(room)); }
  castVote(socket, targetId) {
    const room = this._room(socket); if (!room || room.phase !== 'vote') return;
    const me = this._me(room, socket); if (!me || me.eliminated) return;
    if (!room.players.some(p => p.id === targetId)) return;
    room.votes[me.id] = targetId; this.emitRoom(room);
    const voters = room.players.filter(p => !p.eliminated);
    if (voters.every(p => room.votes[p.id])) this._resolveVotes(room);
  }
  _resolveVotes(room) {
    this._clearTimer(room);
    const tally = {};
    for (const voter in room.votes) { const t = room.votes[voter]; tally[t] = (tally[t] || 0) + 1; }
    let top = null, topN = -1, tie = false;
    for (const id in tally) { if (tally[id] > topN) { top = id; topN = tally[id]; tie = false; } else if (tally[id] === topN) tie = true; }
    const imposterIds = Object.keys(room.roles).filter(id => room.roles[id] === 'imposter');
    const ejected = tie ? null : top;
    const ejectedWasImposter = ejected && room.roles[ejected] === 'imposter';
    room.phase = 'result';
    room.lastResult = { votes: room.votes, tally, ejectedId: ejected, tie, imposterIds, secret: room.secret, crewWins: !!ejectedWasImposter };
    this.io.to(room.code).emit('game:result', room.lastResult);
    this.emitRoom(room);
  }
  nextRound(socket) {
    const room = this._room(socket); if (!room || !this._isHost(room, socket)) return;
    if (room.gameType === 'draw') { this._nextDrawTurn(room); return; }
    if (room.round >= room.settings.rounds) { this._toLobby(room); return; }
    this._beginRound(room);
  }
  backToLobby(socket) { const room = this._room(socket); if (!room || !this._isHost(room, socket)) return; this._toLobby(room); }
  _toLobby(room) {
    this._clearTimer(room);
    room.phase = 'lobby'; room.round = 0; room.votes = {}; room.roles = {}; room.lastResult = null;
    room.scores = null; room.guessed = null; room.drawerId = null; room.word = null;
    room.players.forEach(p => { p.ready = false; p.eliminated = false; });
    this.io.to(room.code).emit('game:toLobby');
    this.emitRoom(room);
  }

  /* ============================ DRAW & GUESS ============================ */
  _beginDraw(room) {
    room.scores = {}; room.players.forEach(p => { room.scores[p.id] = 0; });
    room.drawOrder = shuffle(room.players.map(p => p.id));
    room.drawIndex = 0; room.turnCount = 0;
    room.totalTurns = room.players.length * room.settings.drawRounds;
    this._beginDrawTurn(room);
  }
  _beginDrawTurn(room) {
    // Choisir le prochain dessinateur encore connecté
    const order = room.drawOrder.filter(id => room.players.some(p => p.id === id && p.connected));
    if (order.length === 0) { this._endDrawGame(room); return; }
    room.drawerId = order[room.drawIndex % order.length];
    room.word = DRAW_WORDS[Math.floor(Math.random() * DRAW_WORDS.length)];
    room.guessed = [];
    room.turnStart = Date.now();
    room.phase = 'draw';
    room.turnCount += 1;
    this.io.to(room.code).emit('draw:clear');
    // Mot complet au dessinateur, longueur seule aux autres
    room.players.forEach(p => {
      this.io.to(p.socketId).emit('draw:word', { word: p.id === room.drawerId ? room.word : null, length: room.word.length, isDrawer: p.id === room.drawerId });
    });
    this.emitRoom(room);
    this._setTimer(room, room.settings.drawSec * 1000, () => this._endDrawTurn(room, 'time'));
  }
  relayStroke(socket, stroke) {
    const room = this._room(socket); if (!room || room.phase !== 'draw') return;
    const me = this._me(room, socket); if (!me || me.id !== room.drawerId) return; // seul le dessinateur dessine
    // On relaie tel quel aux autres (données de tracé bornées côté client + ici)
    socket.to(room.code).emit('draw:stroke', stroke);
  }
  clearCanvas(socket) {
    const room = this._room(socket); if (!room || room.phase !== 'draw') return;
    const me = this._me(room, socket); if (!me || me.id !== room.drawerId) return;
    this.io.to(room.code).emit('draw:clear');
  }
  // Retourne true si le message était une bonne réponse (et donc à ne pas diffuser tel quel)
  _handleDrawGuess(room, player, text) {
    if (room.phase !== 'draw') return false;
    if (player.id === room.drawerId) return false;          // le dessinateur ne devine pas
    if (room.guessed.includes(player.id)) return false;      // déjà trouvé
    if (norm(text) === norm(room.word)) {
      room.guessed.push(player.id);
      const elapsed = (Date.now() - room.turnStart) / 1000;
      const gain = Math.max(20, Math.round(120 - elapsed * 1.2)) + (room.guessed.length === 1 ? 30 : 0);
      room.scores[player.id] = (room.scores[player.id] || 0) + gain;
      room.scores[room.drawerId] = (room.scores[room.drawerId] || 0) + 25; // bonus dessinateur
      this.io.to(room.code).emit('draw:correct', { playerId: player.id, name: player.name, order: room.guessed.length });
      this.emitRoom(room);
      // Tous les non-dessinateurs connectés ont trouvé -> fin anticipée
      const others = room.players.filter(p => p.connected && p.id !== room.drawerId);
      if (others.length > 0 && others.every(p => room.guessed.includes(p.id))) this._endDrawTurn(room, 'allFound');
      return true;
    }
    return false;
  }
  _endDrawTurn(room, reason) {
    this._clearTimer(room);
    room.phase = 'drawReveal';
    this.io.to(room.code).emit('draw:reveal', { word: room.word, reason, scores: room.scores, guessed: room.guessed });
    this.emitRoom(room);
    this._setTimer(room, 6000, () => this._nextDrawTurn(room)); // enchaîne automatiquement
  }
  _nextDrawTurn(room) {
    if (room.phase !== 'drawReveal' && room.phase !== 'draw') return;
    this._clearTimer(room);
    room.drawIndex += 1;
    if (room.turnCount >= room.totalTurns) { this._endDrawGame(room); return; }
    this._beginDrawTurn(room);
  }
  _endDrawGame(room) {
    this._clearTimer(room);
    room.phase = 'drawOver';
    const podium = Object.entries(room.scores || {})
      .map(([id, score]) => { const p = room.players.find(x => x.id === id); return { id, name: p?.name || '?', avatar: p?.avatar || 'nebula', score }; })
      .sort((a, b) => b.score - a.score);
    room.drawPodium = podium;
    this.io.to(room.code).emit('draw:over', { podium });
    this.emitRoom(room);
  }

  /* ============================ CHAT ============================ */
  _chatAllowed(room) {
    if (room.gameType === 'draw') return true; // le chat sert aussi à deviner
    // Imposteur : chat libre au lobby, en discussion et au résultat ; bloqué pendant reveal/indices/vote
    return ['lobby', 'discussion', 'result'].includes(room.phase);
  }
  sendChat(socket, text) {
    const room = this._room(socket); if (!room) return;
    const me = this._me(room, socket); if (!me) return;
    const msg = sanitizeChat(text);
    if (!msg) return;
    const now = Date.now();
    if (now - (me.lastChat || 0) < 600) return; // anti-spam : 1 message / 600 ms
    me.lastChat = now;
    if (!this._chatAllowed(room)) return;
    // En Draw & Guess : une bonne réponse est interceptée (non diffusée pour ne pas divulguer le mot)
    if (room.gameType === 'draw' && this._handleDrawGuess(room, me, msg)) return;
    this.io.to(room.code).emit('chat:msg', { playerId: me.id, name: me.name, avatar: me.avatar, text: msg, ts: now });
  }

  /* ============================ CONNEXIONS ============================ */
  handleDisconnect(socket) {
    const idx = this.socketIndex.get(socket.id);
    if (!idx) return;
    const room = this.rooms.get(idx.code);
    this.socketIndex.delete(socket.id);
    if (!room) return;
    const me = room.players.find(p => p.socketId === socket.id);
    if (!me) return;
    const wasDrawer = room.gameType === 'draw' && room.phase === 'draw' && me.id === room.drawerId;
    if (room.phase === 'lobby') room.players = room.players.filter(p => p.socketId !== socket.id);
    else me.connected = false;
    if (me.id === room.hostId) { const next = room.players.find(p => p.connected && p.socketId !== socket.id); if (next) room.hostId = next.id; }
    if (room.players.length === 0 || room.players.every(p => !p.connected)) { this._clearTimer(room); this.rooms.delete(room.code); return; }
    if (wasDrawer) { this._endDrawTurn(room, 'drawerLeft'); return; }
    this.emitRoom(room);
  }
  leaveRoom(socket) { const room = this._room(socket); this.handleDisconnect(socket); if (room) socket.leave(room.code); }

  _setTimer(room, ms, fn) {
    this._clearTimer(room);
    room.endsAt = Date.now() + ms;
    this.io.to(room.code).emit('game:timer', { endsAt: room.endsAt, phase: room.phase });
    room.timer = setTimeout(fn, ms);
  }
  _clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } room.endsAt = null; }
}

function sanitizeName(n) { return String(n || 'Joueur').replace(/[<>]/g, '').slice(0, 18).trim() || 'Joueur'; }
function sanitizeClue(t) { return String(t || '').replace(/[<>]/g, '').slice(0, 40).trim(); }
function sanitizeChat(t) { return String(t || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').slice(0, 140).trim(); }
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
