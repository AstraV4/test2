import { customAlphabet } from 'nanoid';
import { IMPOSTER_WORDS } from './gamedata.js';

const genCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

/**
 * Gestion en mémoire des salons multijoueur.
 * Un salon = { code, hostId, players[], settings, game state... }
 * Toute la logique de jeu (attribution des rôles, phases, votes) est validée
 * ICI, côté serveur — le client ne fait qu'afficher et émettre des intentions.
 */
export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();      // code -> room
    this.socketIndex = new Map(); // socketId -> { code, playerId }
  }

  publicRoom(room) {
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      settings: room.settings,
      round: room.round,
      players: room.players.map(p => ({
        id: p.id, name: p.name, avatar: p.avatar, ready: p.ready,
        connected: p.connected, isHost: p.id === room.hostId,
        hasVoted: room.phase === 'vote' ? !!room.votes?.[p.id] : undefined,
        eliminated: p.eliminated || false,
      })),
    };
  }

  emitRoom(room) { this.io.to(room.code).emit('room:update', this.publicRoom(room)); }

  createRoom(socket, { name, avatar }) {
    let code; do { code = genCode(); } while (this.rooms.has(code));
    const playerId = socket.id;
    const room = {
      code, hostId: playerId, phase: 'lobby', round: 0,
      settings: { imposters: 1, discussionSec: 90, rounds: 1 },
      players: [{ id: playerId, name: sanitizeName(name), avatar: avatar || 'nebula', ready: false, connected: true, socketId: socket.id }],
      votes: {}, roles: {}, clueOrder: [], clueIndex: 0, timer: null,
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
    room.players.push({ id: playerId, name: sanitizeName(name), avatar: avatar || 'nebula', ready: false, connected: true, socketId: socket.id });
    this._bind(socket, code, playerId);
    socket.emit('room:joined', { code, playerId });
    this.emitRoom(room);
  }

  _bind(socket, code, playerId) {
    socket.join(code);
    this.socketIndex.set(socket.id, { code, playerId });
  }

  _room(socket) {
    const idx = this.socketIndex.get(socket.id);
    if (!idx) return null;
    return this.rooms.get(idx.code) || null;
  }
  _me(room, socket) { return room?.players.find(p => p.socketId === socket.id) || null; }
  _isHost(room, socket) { const me = this._me(room, socket); return me && me.id === room.hostId; }

  setReady(socket, ready) {
    const room = this._room(socket); if (!room) return;
    const me = this._me(room, socket); if (!me) return;
    me.ready = !!ready; this.emitRoom(room);
  }

  updateSettings(socket, settings) {
    const room = this._room(socket); if (!room || !this._isHost(room, socket)) return;
    const s = room.settings;
    s.imposters = clamp(parseInt(settings.imposters, 10) || s.imposters, 1, Math.max(1, Math.floor(room.players.length / 3)));
    s.discussionSec = clamp(parseInt(settings.discussionSec, 10) || s.discussionSec, 30, 300);
    s.rounds = clamp(parseInt(settings.rounds, 10) || s.rounds, 1, 5);
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

  // ---- Déroulé Imposteur ----
  startGame(socket) {
    const room = this._room(socket); if (!room || !this._isHost(room, socket)) return;
    if (room.players.length < 3) return socket.emit('room:error', { message: 'Il faut au moins 3 joueurs.' });
    this._beginRound(room);
  }

  _beginRound(room) {
    room.round += 1;
    room.votes = {}; room.roles = {}; room.clueIndex = 0;
    room.players.forEach(p => { p.eliminated = false; });
    const pick = IMPOSTER_WORDS[Math.floor(Math.random() * IMPOSTER_WORDS.length)];
    room.secret = pick;
    // Choisir les imposteurs
    const ids = room.players.map(p => p.id);
    shuffle(ids);
    const impCount = clamp(room.settings.imposters, 1, Math.max(1, Math.floor(ids.length / 3)));
    const imposters = new Set(ids.slice(0, impCount));
    room.players.forEach(p => { room.roles[p.id] = imposters.has(p.id) ? 'imposter' : 'crew'; });
    // Ordre de passage pour les indices
    room.clueOrder = shuffle([...ids]);
    room.phase = 'reveal';
    // Envoi privé du rôle à chacun
    room.players.forEach(p => {
      const role = room.roles[p.id];
      this.io.to(p.socketId).emit('game:role', {
        role,
        theme: pick.theme,
        word: role === 'imposter' ? null : pick.word,
      });
    });
    this.emitRoom(room);
    // Après 6 s : phase indices
    this._setTimer(room, 6000, () => this._startClues(room));
  }

  _startClues(room) {
    room.phase = 'clues';
    room.clueIndex = 0;
    this.emitRoom(room);
    this._promptClue(room);
  }
  _promptClue(room) {
    const activeOrder = room.clueOrder.filter(id => room.players.some(p => p.id === id));
    if (room.clueIndex >= activeOrder.length) { this._startDiscussion(room); return; }
    const currentId = activeOrder[room.clueIndex];
    this.io.to(room.code).emit('game:clueTurn', { currentId, index: room.clueIndex, total: activeOrder.length });
    // 20 s par indice max (auto-skip)
    this._setTimer(room, 20000, () => { room.clueIndex++; this._promptClue(room); });
  }
  submitClue(socket, text) {
    const room = this._room(socket); if (!room || room.phase !== 'clues') return;
    const me = this._me(room, socket); if (!me) return;
    const activeOrder = room.clueOrder.filter(id => room.players.some(p => p.id === id));
    if (activeOrder[room.clueIndex] !== me.id) return; // pas son tour
    const clue = sanitizeClue(text);
    this.io.to(room.code).emit('game:clue', { playerId: me.id, name: me.name, clue });
    room.clueIndex++;
    this._promptClue(room);
  }

  _startDiscussion(room) {
    room.phase = 'discussion';
    this.emitRoom(room);
    this._setTimer(room, room.settings.discussionSec * 1000, () => this._startVote(room));
  }
  skipToVote(socket) {
    const room = this._room(socket); if (!room || !this._isHost(room, socket)) return;
    if (room.phase === 'discussion') this._startVote(room);
  }
  _startVote(room) {
    room.phase = 'vote'; room.votes = {};
    this.emitRoom(room);
    this._setTimer(room, 45000, () => this._resolveVotes(room));
  }
  castVote(socket, targetId) {
    const room = this._room(socket); if (!room || room.phase !== 'vote') return;
    const me = this._me(room, socket); if (!me || me.eliminated) return;
    if (!room.players.some(p => p.id === targetId)) return;
    room.votes[me.id] = targetId;
    this.emitRoom(room);
    // Tout le monde a voté ?
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
    room.lastResult = {
      votes: room.votes,
      tally,
      ejectedId: ejected,
      tie,
      imposterIds,
      secret: room.secret,
      crewWins: !!ejectedWasImposter,
    };
    this.io.to(room.code).emit('game:result', room.lastResult);
    this.emitRoom(room);
  }
  nextRound(socket) {
    const room = this._room(socket); if (!room || !this._isHost(room, socket)) return;
    if (room.round >= room.settings.rounds) { this._toLobby(room); return; }
    this._beginRound(room);
  }
  backToLobby(socket) {
    const room = this._room(socket); if (!room || !this._isHost(room, socket)) return;
    this._toLobby(room);
  }
  _toLobby(room) {
    this._clearTimer(room);
    room.phase = 'lobby'; room.round = 0; room.votes = {}; room.roles = {}; room.lastResult = null;
    room.players.forEach(p => { p.ready = false; p.eliminated = false; });
    this.io.to(room.code).emit('game:toLobby');
    this.emitRoom(room);
  }

  // ---- Connexions ----
  handleDisconnect(socket) {
    const idx = this.socketIndex.get(socket.id);
    if (!idx) return;
    const room = this.rooms.get(idx.code);
    this.socketIndex.delete(socket.id);
    if (!room) return;
    const me = room.players.find(p => p.socketId === socket.id);
    if (!me) return;
    if (room.phase === 'lobby') {
      room.players = room.players.filter(p => p.socketId !== socket.id);
    } else {
      me.connected = false; // on garde la place pendant la partie (reconnexion possible)
    }
    // Transfert d'hôte si l'hôte part
    if (me.id === room.hostId) {
      const next = room.players.find(p => p.connected && p.socketId !== socket.id);
      if (next) room.hostId = next.id;
    }
    // Salon vide -> suppression
    if (room.players.length === 0 || room.players.every(p => !p.connected)) {
      this._clearTimer(room);
      this.rooms.delete(room.code);
      return;
    }
    this.emitRoom(room);
  }

  leaveRoom(socket) {
    const room = this._room(socket);
    this.handleDisconnect(socket);
    if (room) { socket.leave(room.code); }
  }

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
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
