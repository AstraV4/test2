import { customAlphabet } from 'nanoid';
import { pickImposterWord, IMPOSTER_THEME_LIST, DRAW_WORDS, buildPartyRound, BLUFF_QA, CAPTION_PROMPTS } from './gamedata.js';

const genCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

/**
 * Gestion en mémoire des salons multijoueur.
 * Deux jeux : 'imposter' et 'draw' (Draw & Guess).
 * Toute la logique (rôles, phases, votes, mots, scores) est validée ICI, côté
 * serveur. Le client n'émet que des intentions et affiche l'état reçu.
 */
export class RoomManager {
  constructor(io, presence = null) {
    this.io = io;
    this.presence = presence;
    this.rooms = new Map();       // code -> room
    this.socketIndex = new Map(); // socketId -> { code, playerId }
  }

  // Activité (présence) : appelée quand un salon change d'état.
  _touchActivity(room) {
    if (!this.presence) return;
    for (const p of room.players) {
      if (!p.connected) continue;
      const s = this.io.sockets.sockets.get(p.socketId);
      const uid = s?.data?.userId;
      if (uid) this.presence.setActivity(uid, { code: room.code, gameType: room.gameType, phase: room.phase });
    }
  }
  _clearActivity(socket) {
    const uid = socket?.data?.userId;
    if (uid && this.presence) this.presence.setActivity(uid, null);
  }
  roomCodeOf(socket) { const idx = this.socketIndex.get(socket.id); return idx ? idx.code : null; }
  roomGameType(code) { const r = this.rooms.get(code); return r ? r.gameType : null; }

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
      themes: ['Aléatoire', ...IMPOSTER_THEME_LIST],
    };
    if (room.gameType === 'draw') {
      base.draw = {
        drawerId: room.drawerId || null,
        wordLength: room.word ? room.word.length : null,
        turn: room.turnCount || 0,
        totalTurns: room.totalTurns || 0,
      };
    }
    if (room.gameType === 'bluff' && room.bluff) {
      const b = room.bluff;
      base.bluff = {
        question: b.question,
        turn: room.bluffTurn || 0, total: room.bluffTotal || 0,
        answeredIds: Object.keys(b.answers || {}),
        options: (room.phase === 'bluffGuess') ? (b.options || []).map((o, i) => ({ i, text: o.text })) : null,
        pickedIds: Object.keys(b.picks || {}),
        reveal: b.reveal || null,
      };
    }
    if (room.gameType === 'caption' && room.caption) {
      const c = room.caption;
      base.caption = {
        prompt: c.prompt,
        turn: room.capTurn || 0, total: room.capTotal || 0,
        answeredIds: Object.keys(c.answers || {}),
        entries: (room.phase === 'capVote') ? (c.entries || []).map(e => ({ id: e.id, text: e.text })) : null,
        votedIds: Object.keys(c.votes || {}),
        reveal: c.reveal || null,
      };
    }
    if (room.gameType === 'party' && room.partyRound) {
      const r = room.partyRound;
      base.party = {
        format: r.format,
        prompt: r.prompt,
        options: r.options,
        turn: room.partyTurn || 0,
        total: room.partyTotal || 0,
        votedIds: Object.keys(r.votes || {}),   // qui a voté (pas leur choix)
        reveal: room.partyReveal || null,        // rempli seulement après révélation
      };
    }
    if (DUEL_GAMES.has(room.gameType) && room.duel) {
      const d = room.duel;
      base.duel = {
        game: d.game, target: d.target, scores: d.scores, round: d.round,
        turn: d.turn || null, roundOver: !!d.roundOver, roundWinner: d.roundWinner || null,
        matchOver: !!d.matchOver, winnerId: d.winnerId || null,
        symbols: d.symbols || null, board: d.board || null,
        chosenIds: d.choices ? Object.keys(d.choices) : [], reveal: d.reveal || null,
        state: d.state || null, lastRt: d.lastRt || null,
        problem: d.problem ? { text: d.problem.text } : null,
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
      settings: { imposters: 1, discussionSec: 90, rounds: 1, theme: 'Aléatoire', drawSec: 75, drawRounds: 1, partyRounds: 8, bluffRounds: 5, captionRounds: 5 },
      players: [{ id: playerId, name: sanitizeName(name), avatar: avatar || 'nebula', ready: false, connected: true, socketId: socket.id, lastChat: 0 }],
      votes: {}, roles: {}, clueOrder: [], clueIndex: 0, timer: null,
      scores: null, guessed: null, drawerId: null, word: null,
    };
    this.rooms.set(code, room);
    this._bind(socket, code, playerId);
    socket.emit('room:joined', { code, playerId });
    this.emitRoom(room);
    this._touchActivity(room);
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
    this._touchActivity(room);
  }

  _bind(socket, code, playerId) { socket.join(code); this.socketIndex.set(socket.id, { code, playerId }); }
  _room(socket) { const idx = this.socketIndex.get(socket.id); return idx ? (this.rooms.get(idx.code) || null) : null; }
  _me(room, socket) { return room?.players.find(p => p.socketId === socket.id) || null; }
  _isHost(room, socket) { const me = this._me(room, socket); return me && me.id === room.hostId; }

  setGameType(socket, type) {
    const room = this._room(socket); if (!room || !this._isHost(room, socket) || room.phase !== 'lobby') return;
    if (['imposter', 'draw', 'party', 'bluff', 'caption', 'morpion', 'connect4', 'rps', 'reflexduel', 'mathduel'].includes(type)) { room.gameType = type; this.emitRoom(room); this._touchActivity(room); }
  }

  // Renvoie l'état privé courant à un joueur qui (ré)affiche le jeu.
  // Corrige le cas où le composant s'abonne après l'émission initiale + les reconnexions.
  syncPlayer(socket) {
    const room = this._room(socket); if (!room) return;
    const me = this._me(room, socket); if (!me) return;
    if (room.gameType === 'imposter' && room.roles && room.roles[me.id]) {
      const role = room.roles[me.id];
      socket.emit('game:role', { role, theme: room.secret?.theme, word: role === 'imposter' ? null : room.secret?.word });
    }
    if (room.gameType === 'draw') {
      if (room.phase === 'drawPick' && me.id === room.drawerId && room.choices) {
        socket.emit('draw:choices', { words: room.choices });
      } else if ((room.phase === 'draw' || room.phase === 'drawReveal') && room.word) {
        socket.emit('draw:word', { word: me.id === room.drawerId ? room.word : null, length: room.word.length, isDrawer: me.id === room.drawerId });
        if (room.hintPattern) socket.emit('draw:hint', { pattern: room.hintPattern });
      }
    }
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
    if (settings.theme != null) s.theme = String(settings.theme).slice(0, 24);
    if (settings.drawSec != null) s.drawSec = clamp(parseInt(settings.drawSec, 10) || s.drawSec, 40, 150);
    if (settings.drawRounds != null) s.drawRounds = clamp(parseInt(settings.drawRounds, 10) || s.drawRounds, 1, 3);
    if (settings.partyRounds != null) s.partyRounds = clamp(parseInt(settings.partyRounds, 10) || s.partyRounds, 3, 15);
    if (settings.bluffRounds != null) s.bluffRounds = clamp(parseInt(settings.bluffRounds, 10) || s.bluffRounds, 3, 10);
    if (settings.captionRounds != null) s.captionRounds = clamp(parseInt(settings.captionRounds, 10) || s.captionRounds, 3, 10);
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
    const isDuel = ['morpion', 'connect4', 'rps', 'reflexduel', 'mathduel'].includes(room.gameType);
    if (isDuel) { if (room.players.length !== 2) return socket.emit('room:error', { message: 'Ce jeu se joue exactement à 2 joueurs.' }); }
    else if (room.players.length < 3) return socket.emit('room:error', { message: 'Il faut au moins 3 joueurs.' });
    if (room.gameType === 'draw') this._beginDraw(room);
    else if (room.gameType === 'party') this._beginParty(room);
    else if (room.gameType === 'bluff') this._beginBluff(room);
    else if (room.gameType === 'caption') this._beginCaption(room);
    else if (DUEL_GAMES.has(room.gameType)) { this._beginDuel(room); }
    else this._beginRound(room);
    this._touchActivity(room);
  }

  /* ============================ IMPOSTEUR ============================ */
  _beginRound(room) {
    room.round += 1;
    room.votes = {}; room.roles = {}; room.clueIndex = 0;
    room.players.forEach(p => { p.eliminated = false; });
    const pick = pickImposterWord(room.settings.theme);
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
    if (room.gameType === 'party') { this._nextParty(room); return; }
    if (room.gameType === 'bluff') { this._nextBluff(room); return; }
    if (room.gameType === 'caption') { this._nextCaption(room); return; }
    if (DUEL_GAMES.has(room.gameType)) { if (room.duel && room.duel.matchOver) this._beginDuel(room); return; }
    if (room.round >= room.settings.rounds) { this._toLobby(room); return; }
    this._beginRound(room);
  }
  backToLobby(socket) { const room = this._room(socket); if (!room || !this._isHost(room, socket)) return; this._toLobby(room); }
  _toLobby(room) {
    this._clearTimer(room);
    room.phase = 'lobby'; room.round = 0; room.votes = {}; room.roles = {}; room.lastResult = null;
    room.scores = null; room.guessed = null; room.drawerId = null; room.word = null;
    room.partyRound = null; room.partyReveal = null; room.partyTurn = 0; room.partyUsed = null;
    room.bluff = null; room.caption = null;
    room.duel = null;
    room.players.forEach(p => { p.ready = false; p.eliminated = false; });
    this.io.to(room.code).emit('game:toLobby');
    this.emitRoom(room);
    this._touchActivity(room);
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
    room.word = null; room.hintPattern = null; room.revealed = null; room.guessed = [];
    room.choices = pickN(DRAW_WORDS, 3);
    room.phase = 'drawPick';
    room.turnCount += 1;
    this.io.to(room.code).emit('draw:clear');
    const ds = this._sockOf(room, room.drawerId);
    if (ds) this.io.to(ds).emit('draw:choices', { words: room.choices });
    this.emitRoom(room);
    // Auto-choix si le dessinateur ne choisit pas à temps
    this._setTimer(room, 15000, () => this._chooseWord(room, 0));
  }
  pickDrawWord(socket, index) {
    const room = this._room(socket); if (!room || room.phase !== 'drawPick') return;
    const me = this._me(room, socket); if (!me || me.id !== room.drawerId) return;
    this._chooseWord(room, index);
  }
  _chooseWord(room, index) {
    if (room.phase !== 'drawPick' || !room.choices) return;
    room.word = room.choices[clamp(parseInt(index, 10) || 0, 0, room.choices.length - 1)];
    this._startDrawing(room);
  }
  _startDrawing(room) {
    room.phase = 'draw';
    room.guessed = [];
    room.turnStart = Date.now();
    room.revealed = new Set();
    room.hintPattern = buildPattern(room.word, room.revealed);
    this.io.to(room.code).emit('draw:clear');
    room.players.forEach(p => {
      this.io.to(p.socketId).emit('draw:word', { word: p.id === room.drawerId ? room.word : null, length: room.word.length, isDrawer: p.id === room.drawerId });
    });
    this.io.to(room.code).emit('draw:hint', { pattern: room.hintPattern });
    this.emitRoom(room);
    // Fin du tour
    this._setTimer(room, room.settings.drawSec * 1000, () => this._endDrawTurn(room, 'time'));
    // Indices de lettres progressifs (jusqu'à la moitié des lettres)
    const positions = [];
    for (let i = 0; i < room.word.length; i++) if (isLetter(room.word[i])) positions.push(i);
    shuffle(positions);
    const maxReveal = Math.floor(positions.length / 2);
    let step = 0;
    const gap = (room.settings.drawSec * 1000) / (maxReveal + 1);
    const scheduleHint = () => {
      if (step >= maxReveal || room.phase !== 'draw') return;
      room.revealed.add(positions[step]); step++;
      room.hintPattern = buildPattern(room.word, room.revealed);
      this.io.to(room.code).emit('draw:hint', { pattern: room.hintPattern });
      room.hintTimer = setTimeout(scheduleHint, gap);
    };
    room.hintTimer = setTimeout(scheduleHint, gap);
  }
  _beginDrawTurnLegacyUnused(room) {}
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

  /* ============================ PARTY (jeux à voter) ============================ */
  _beginParty(room) {
    room.scores = {}; room.players.forEach(p => { room.scores[p.id] = 0; });
    room.partyUsed = new Set();
    room.partyTurn = 0;
    room.partyTotal = room.settings.partyRounds;
    room.partyFormats = ['wyr', 'most', 'hot'];
    this._beginPartyRound(room);
  }
  _beginPartyRound(room) {
    room.partyTurn += 1;
    room.partyReveal = null;
    // alterne les formats pour varier
    const format = room.partyFormats[(room.partyTurn - 1) % room.partyFormats.length];
    const players = room.players.filter(p => p.connected).map(p => ({ id: p.id, name: p.name, avatar: p.avatar }));
    room.partyRound = { ...buildPartyRound(format, room.partyUsed, players), votes: {} };
    room.phase = 'party';
    this.emitRoom(room);
    this._setTimer(room, 30000, () => this._revealParty(room)); // 30 s pour voter
  }
  castPartyVote(socket, choice) {
    const room = this._room(socket); if (!room || room.phase !== 'party' || !room.partyRound || room.partyReveal) return;
    const me = this._me(room, socket); if (!me) return;
    const r = room.partyRound;
    if (r.format === 'most') {
      if (!r.options.some(o => o.id === choice)) return;
      r.votes[me.id] = choice;
    } else {
      const c = parseInt(choice, 10);
      if (c !== 0 && c !== 1) return;
      r.votes[me.id] = c;
    }
    this.emitRoom(room);
    const voters = room.players.filter(p => p.connected);
    if (voters.length > 0 && voters.every(p => r.votes[p.id] !== undefined)) this._revealParty(room);
  }
  _revealParty(room) {
    this._clearTimer(room);
    const r = room.partyRound; if (!r || room.partyReveal) return;
    const votes = r.votes || {};
    let reveal;
    if (r.format === 'most') {
      const tally = {};
      for (const v in votes) tally[votes[v]] = (tally[votes[v]] || 0) + 1;
      let winnerId = null, best = -1;
      for (const id in tally) if (tally[id] > best) { best = tally[id]; winnerId = id; }
      // points : les votants ayant choisi le gagnant + le gagnant lui-même
      for (const v in votes) if (votes[v] === winnerId) room.scores[v] = (room.scores[v] || 0) + 1;
      if (winnerId) room.scores[winnerId] = (room.scores[winnerId] || 0) + 1;
      const winner = room.players.find(p => p.id === winnerId);
      reveal = { format: 'most', tally, winnerId, winnerName: winner?.name || null, options: r.options, votes };
    } else {
      const counts = [0, 0];
      for (const v in votes) counts[votes[v]]++;
      const majority = counts[0] === counts[1] ? -1 : (counts[0] > counts[1] ? 0 : 1);
      for (const v in votes) { if (majority === -1 || votes[v] === majority) room.scores[v] = (room.scores[v] || 0) + 1; }
      reveal = { format: r.format, counts, options: r.options, majority, votes, total: Object.keys(votes).length };
    }
    room.partyReveal = reveal;
    room.phase = 'partyReveal';
    this.io.to(room.code).emit('party:reveal', reveal);
    this.emitRoom(room);
    this._setTimer(room, 9000, () => this._nextParty(room)); // enchaîne automatiquement
  }
  _nextParty(room) {
    this._clearTimer(room);
    if (room.partyTurn >= room.partyTotal) { this._endParty(room); return; }
    this._beginPartyRound(room);
  }
  _endParty(room) {
    this._clearTimer(room);
    room.phase = 'partyOver';
    const podium = Object.entries(room.scores || {})
      .map(([id, score]) => { const p = room.players.find(x => x.id === id); return { id, name: p?.name || '?', avatar: p?.avatar || 'nebula', score }; })
      .sort((a, b) => b.score - a.score);
    room.partyPodium = podium;
    this.io.to(room.code).emit('party:over', { podium });
    this.emitRoom(room);
  }

  /* ============================ BLUFF ============================ */
  _beginBluff(room) {
    room.scores = {}; room.players.forEach(p => { room.scores[p.id] = 0; });
    room.bluffUsed = new Set(); room.bluffTurn = 0; room.bluffTotal = room.settings.bluffRounds;
    this._beginBluffRound(room);
  }
  _beginBluffRound(room) {
    room.bluffTurn += 1;
    let idx = Math.floor(Math.random() * BLUFF_QA.length);
    for (let i = 0; i < BLUFF_QA.length && room.bluffUsed.has(idx); i++) idx = (idx + 1) % BLUFF_QA.length;
    room.bluffUsed.add(idx);
    const qa = BLUFF_QA[idx];
    room.bluff = { question: qa.q, real: qa.a, answers: {}, options: null, picks: {}, truth: new Set(), reveal: null };
    room.phase = 'bluffWrite';
    this.emitRoom(room);
    this._setTimer(room, 40000, () => this._bluffToGuess(room));
  }
  bluffAnswer(socket, text) {
    const room = this._room(socket); if (!room || room.phase !== 'bluffWrite') return;
    const me = this._me(room, socket); if (!me) return;
    const t = sanitizeChat(text); if (!t) return;
    room.bluff.answers[me.id] = t;
    this.emitRoom(room);
    const voters = room.players.filter(p => p.connected);
    if (voters.length && voters.every(p => room.bluff.answers[p.id] !== undefined)) this._bluffToGuess(room);
  }
  _bluffToGuess(room) {
    this._clearTimer(room);
    const b = room.bluff; if (!b || b.options) return;
    const map = new Map(); // norm -> { text, ownerIds:Set }
    for (const pid in b.answers) {
      const txt = b.answers[pid];
      if (norm(txt) === norm(b.real)) { b.truth.add(pid); continue; } // a écrit la vérité
      const key = norm(txt);
      if (!map.has(key)) map.set(key, { text: txt, ownerIds: new Set(), real: false });
      map.get(key).ownerIds.add(pid);
    }
    const opts = [...map.values()];
    opts.push({ text: b.real, ownerIds: new Set(), real: true });
    shuffle(opts);
    b.options = opts.map(o => ({ text: o.text, ownerIds: [...o.ownerIds], real: o.real }));
    room.phase = 'bluffGuess';
    this.emitRoom(room);
    this._setTimer(room, 30000, () => this._bluffReveal(room));
  }
  bluffPick(socket, index) {
    const room = this._room(socket); if (!room || room.phase !== 'bluffGuess') return;
    const me = this._me(room, socket); if (!me) return;
    const b = room.bluff; const i = parseInt(index, 10);
    if (!b.options[i]) return;
    if (b.options[i].ownerIds.includes(me.id)) return; // pas son propre bluff
    if (b.truth.has(me.id)) return;                    // a déjà trouvé la vérité
    b.picks[me.id] = i;
    this.emitRoom(room);
    const voters = room.players.filter(p => p.connected && !b.truth.has(p.id));
    if (voters.length && voters.every(p => b.picks[p.id] !== undefined)) this._bluffReveal(room);
  }
  _bluffReveal(room) {
    this._clearTimer(room);
    const b = room.bluff; if (!b || b.reveal) return;
    const realIndex = b.options.findIndex(o => o.real);
    const votesByOpt = b.options.map(() => []);
    for (const pid in b.picks) { const i = b.picks[pid]; if (votesByOpt[i]) votesByOpt[i].push(pid); }
    // Scoring
    for (const pid in b.picks) { if (b.picks[pid] === realIndex) room.scores[pid] += 100; }
    b.options.forEach((o, i) => { if (!o.real) { const fooled = votesByOpt[i].length; o.ownerIds.forEach(oid => { room.scores[oid] = (room.scores[oid] || 0) + 50 * fooled; }); } });
    b.truth.forEach(pid => { room.scores[pid] = (room.scores[pid] || 0) + 100; });
    const nameOf = (id) => room.players.find(p => p.id === id)?.name || '?';
    b.reveal = {
      realIndex,
      options: b.options.map((o, i) => ({ text: o.text, real: o.real, owners: o.ownerIds.map(nameOf), voters: votesByOpt[i].map(nameOf) })),
      truthFinders: [...b.truth].map(nameOf),
      scores: room.scores,
    };
    room.phase = 'bluffReveal';
    this.io.to(room.code).emit('bluff:reveal', b.reveal);
    this.emitRoom(room);
    this._setTimer(room, 10000, () => this._nextBluff(room));
  }
  _nextBluff(room) {
    this._clearTimer(room);
    if (room.bluffTurn >= room.bluffTotal) { this._endGeneric(room, 'bluff:over'); return; }
    this._beginBluffRound(room);
  }

  /* ============================ CAPTION BATTLE ============================ */
  _beginCaption(room) {
    room.scores = {}; room.players.forEach(p => { room.scores[p.id] = 0; });
    room.capUsed = new Set(); room.capTurn = 0; room.capTotal = room.settings.captionRounds;
    this._beginCaptionRound(room);
  }
  _beginCaptionRound(room) {
    room.capTurn += 1;
    let idx = Math.floor(Math.random() * CAPTION_PROMPTS.length);
    for (let i = 0; i < CAPTION_PROMPTS.length && room.capUsed.has(idx); i++) idx = (idx + 1) % CAPTION_PROMPTS.length;
    room.capUsed.add(idx);
    room.caption = { prompt: CAPTION_PROMPTS[idx], answers: {}, entries: null, votes: {}, reveal: null };
    room.phase = 'capWrite';
    this.emitRoom(room);
    this._setTimer(room, 45000, () => this._capToVote(room));
  }
  captionAnswer(socket, text) {
    const room = this._room(socket); if (!room || room.phase !== 'capWrite') return;
    const me = this._me(room, socket); if (!me) return;
    const t = sanitizeChat(text); if (!t) return;
    room.caption.answers[me.id] = t;
    this.emitRoom(room);
    const voters = room.players.filter(p => p.connected);
    if (voters.length && voters.every(p => room.caption.answers[p.id] !== undefined)) this._capToVote(room);
  }
  _capToVote(room) {
    this._clearTimer(room);
    const c = room.caption; if (!c || c.entries) return;
    c.entries = Object.entries(c.answers).map(([id, text]) => ({ id, text }));
    shuffle(c.entries);
    if (c.entries.length < 2) { this._capReveal(room); return; } // pas assez de réponses
    room.phase = 'capVote';
    this.emitRoom(room);
    this._setTimer(room, 30000, () => this._capReveal(room));
  }
  captionVote(socket, targetId) {
    const room = this._room(socket); if (!room || room.phase !== 'capVote') return;
    const me = this._me(room, socket); if (!me) return;
    const c = room.caption;
    if (targetId === me.id) return;                       // pas voter pour soi
    if (!c.entries.some(e => e.id === targetId)) return;
    c.votes[me.id] = targetId;
    this.emitRoom(room);
    const voters = room.players.filter(p => p.connected);
    if (voters.length && voters.every(p => c.votes[p.id] !== undefined)) this._capReveal(room);
  }
  _capReveal(room) {
    this._clearTimer(room);
    const c = room.caption; if (!c || c.reveal) return;
    const tally = {}; for (const v in c.votes) tally[c.votes[v]] = (tally[c.votes[v]] || 0) + 1;
    (c.entries || []).forEach(e => { const v = tally[e.id] || 0; room.scores[e.id] = (room.scores[e.id] || 0) + v * 100; });
    let winnerId = null, best = -1; for (const id in tally) if (tally[id] > best) { best = tally[id]; winnerId = id; }
    const nameOf = (id) => room.players.find(p => p.id === id)?.name || '?';
    c.reveal = {
      prompt: c.prompt,
      entries: (c.entries || []).map(e => ({ author: nameOf(e.id), text: e.text, votes: tally[e.id] || 0 })).sort((a, b) => b.votes - a.votes),
      winner: winnerId ? nameOf(winnerId) : null,
      scores: room.scores,
    };
    room.phase = 'capReveal';
    this.io.to(room.code).emit('caption:reveal', c.reveal);
    this.emitRoom(room);
    this._setTimer(room, 10000, () => this._nextCaption(room));
  }
  _nextCaption(room) {
    this._clearTimer(room);
    if (room.capTurn >= room.capTotal) { this._endGeneric(room, 'caption:over'); return; }
    this._beginCaptionRound(room);
  }

  // Podium générique (bluff/caption)
  _endGeneric(room, event) {
    this._clearTimer(room);
    room.phase = event === 'bluff:over' ? 'bluffOver' : 'capOver';
    const podium = Object.entries(room.scores || {})
      .map(([id, score]) => { const p = room.players.find(x => x.id === id); return { id, name: p?.name || '?', avatar: p?.avatar || 'nebula', score }; })
      .sort((a, b) => b.score - a.score);
    room.genericPodium = podium;
    this.io.to(room.code).emit(event, { podium });
    this.emitRoom(room);
  }

  /* ============================ DUELS (1 contre 1) ============================ */
  _beginDuel(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { const s = this.io.sockets.sockets.get(room.players.find(p => p.id === room.hostId)?.socketId); s?.emit('room:error', { message: 'Ce jeu se joue exactement à 2 joueurs.' }); return; }
    const target = (room.gameType === 'reflexduel' || room.gameType === 'mathduel') ? 5 : 3;
    room.duel = { game: room.gameType, p: [ids[0], ids[1]], target, scores: { [ids[0]]: 0, [ids[1]]: 0 }, round: 0, matchOver: false, winnerId: null };
    room.phase = 'duel';
    this._duelStartRound(room);
  }
  _duelStartRound(room) {
    this._clearTimer(room);
    const d = room.duel; d.round += 1; d.roundOver = false; d.roundWinner = null; d.reveal = null; d.lastRt = null;
    const [a, b] = d.p;
    const starter = d.p[(d.round - 1) % 2]; // alterne qui commence
    if (d.game === 'morpion') { d.board = Array(9).fill(null); d.symbols = { [a]: 'X', [b]: 'O' }; d.turn = starter; }
    else if (d.game === 'connect4') { d.board = Array(42).fill(null); d.symbols = { [a]: 'R', [b]: 'J' }; d.turn = starter; }
    else if (d.game === 'rps') { d.choices = {}; d.turn = null; }
    else if (d.game === 'reflexduel') {
      d.state = 'waiting'; d.turn = null; d.goAt = null;
      room.duelGoTimer = setTimeout(() => { if (room.duel !== d || d.roundOver) return; d.state = 'go'; d.goAt = Date.now(); this.io.to(room.code).emit('duel:go', {}); this.emitRoom(room); }, 1500 + Math.random() * 2800);
    }
    else if (d.game === 'mathduel') { d.problem = makeMath(d.round); d.turn = null; }
    this.emitRoom(room);
  }
  _duelWin(room, winnerId, extra = {}) {
    const d = room.duel; if (!d || d.roundOver) return;
    d.roundOver = true; d.roundWinner = winnerId; // winnerId peut être 'draw'
    if (winnerId && winnerId !== 'draw') d.scores[winnerId] = (d.scores[winnerId] || 0) + 1;
    if (extra.rt != null) d.lastRt = extra.rt;
    if (extra.reveal) d.reveal = extra.reveal;
    if (winnerId && winnerId !== 'draw' && d.scores[winnerId] >= d.target) {
      d.matchOver = true; d.winnerId = winnerId; room.phase = 'duelOver';
      this.io.to(room.code).emit('duel:over', { winnerId });
      this.emitRoom(room);
    } else {
      this.emitRoom(room);
      room.duelTimer = setTimeout(() => this._duelStartRound(room), 2600);
    }
  }
  duelCell(socket, cell) {
    const room = this._room(socket); const d = room?.duel; if (!room || !d || d.game !== 'morpion' || room.phase !== 'duel' || d.roundOver) return;
    const me = this._me(room, socket); if (!me || me.id !== d.turn) return;
    const i = parseInt(cell, 10); if (!(i >= 0 && i < 9) || d.board[i]) return;
    d.board[i] = d.symbols[me.id];
    const w = ticWinner(d.board);
    if (w) return this._duelWin(room, me.id, { line: w });
    if (d.board.every(Boolean)) return this._duelWin(room, 'draw');
    d.turn = d.p.find(x => x !== me.id); this.emitRoom(room);
  }
  duelCol(socket, col) {
    const room = this._room(socket); const d = room?.duel; if (!room || !d || d.game !== 'connect4' || room.phase !== 'duel' || d.roundOver) return;
    const me = this._me(room, socket); if (!me || me.id !== d.turn) return;
    const c = parseInt(col, 10); if (!(c >= 0 && c < 7)) return;
    let placed = -1;
    for (let r = 5; r >= 0; r--) { const idx = r * 7 + c; if (!d.board[idx]) { d.board[idx] = d.symbols[me.id]; placed = idx; break; } }
    if (placed === -1) return; // colonne pleine
    if (connect4Win(d.board, placed)) return this._duelWin(room, me.id);
    if (d.board.every(Boolean)) return this._duelWin(room, 'draw');
    d.turn = d.p.find(x => x !== me.id); this.emitRoom(room);
  }
  duelRps(socket, choice) {
    const room = this._room(socket); const d = room?.duel; if (!room || !d || d.game !== 'rps' || room.phase !== 'duel' || d.roundOver) return;
    const me = this._me(room, socket); if (!me) return;
    if (!['pierre', 'feuille', 'ciseaux'].includes(choice)) return;
    d.choices[me.id] = choice; this.emitRoom(room);
    if (Object.keys(d.choices).length === 2) {
      const [a, b] = d.p; const ca = d.choices[a], cb = d.choices[b];
      const beats = { pierre: 'ciseaux', feuille: 'pierre', ciseaux: 'feuille' };
      let winner = 'draw'; if (ca !== cb) winner = beats[ca] === cb ? a : b;
      this._duelWin(room, winner, { reveal: { choices: { ...d.choices } } });
    }
  }
  duelTap(socket) {
    const room = this._room(socket); const d = room?.duel; if (!room || !d || d.game !== 'reflexduel' || room.phase !== 'duel' || d.roundOver) return;
    const me = this._me(room, socket); if (!me) return;
    if (d.state === 'waiting') { const opp = d.p.find(x => x !== me.id); return this._duelWin(room, opp, { falseStart: true }); } // faux départ
    if (d.state === 'go') { const rt = Date.now() - (d.goAt || Date.now()); return this._duelWin(room, me.id, { rt }); }
  }
  duelAnswer(socket, value) {
    const room = this._room(socket); const d = room?.duel; if (!room || !d || d.game !== 'mathduel' || room.phase !== 'duel' || d.roundOver) return;
    const me = this._me(room, socket); if (!me) return;
    if (parseInt(value, 10) === d.problem.answer) this._duelWin(room, me.id);
  }

  /* ============================ CHAT ============================ */
  _chatAllowed(room) {
    if (room.gameType === 'draw') return true; // le chat sert aussi à deviner
    if (room.gameType === 'party' || room.gameType === 'bluff' || room.gameType === 'caption') return true; // social
    if (DUEL_GAMES.has(room.gameType)) return true; // 1v1 : chat libre
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
    const wasDrawer = room.gameType === 'draw' && (room.phase === 'draw' || room.phase === 'drawPick') && me.id === room.drawerId;
    if (room.phase === 'lobby') room.players = room.players.filter(p => p.socketId !== socket.id);
    else me.connected = false;
    if (me.id === room.hostId) { const next = room.players.find(p => p.connected && p.socketId !== socket.id); if (next) room.hostId = next.id; }
    if (room.players.length === 0 || room.players.every(p => !p.connected)) { this._clearTimer(room); this.rooms.delete(room.code); return; }
    this._clearActivity(socket);
    if (DUEL_GAMES.has(room.gameType) && room.duel && !room.duel.matchOver && (room.phase === 'duel' || room.phase === 'duelOver')) {
      const remaining = room.players.find(p => p.connected);
      if (remaining) { room.duel.matchOver = true; room.duel.winnerId = remaining.id; room.phase = 'duelOver'; this._clearTimer(room); this.io.to(room.code).emit('duel:over', { winnerId: remaining.id, forfeit: true }); this.emitRoom(room); return; }
    }
    if (wasDrawer) { this._endDrawTurn(room, 'drawerLeft'); return; }
    this.emitRoom(room);
  }
  leaveRoom(socket) { const room = this._room(socket); this._clearActivity(socket); this.handleDisconnect(socket); if (room) socket.leave(room.code); }

  _setTimer(room, ms, fn) {
    this._clearTimer(room);
    room.endsAt = Date.now() + ms;
    this.io.to(room.code).emit('game:timer', { endsAt: room.endsAt, phase: room.phase });
    room.timer = setTimeout(fn, ms);
  }
  _clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } if (room.hintTimer) { clearTimeout(room.hintTimer); room.hintTimer = null; } if (room.duelTimer) { clearTimeout(room.duelTimer); room.duelTimer = null; } if (room.duelGoTimer) { clearTimeout(room.duelGoTimer); room.duelGoTimer = null; } room.endsAt = null; }
  _sockOf(room, playerId) { const p = room.players.find(x => x.id === playerId); return p ? p.socketId : null; }
}

function sanitizeName(n) { return String(n || 'Joueur').replace(/[<>]/g, '').slice(0, 18).trim() || 'Joueur'; }
function sanitizeClue(t) { return String(t || '').replace(/[<>]/g, '').slice(0, 40).trim(); }
function sanitizeChat(t) { return String(t || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').slice(0, 140).trim(); }
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function pickN(arr, n) { return shuffle([...arr]).slice(0, n); }
function isLetter(c) { return /[a-zA-Z0-9À-ÿ]/.test(c); }
function buildPattern(word, revealed) { return [...word].map((c, i) => (isLetter(c) ? (revealed.has(i) ? c : '_') : c)).join(''); }

const DUEL_GAMES = new Set(['morpion', 'connect4', 'rps', 'reflexduel', 'mathduel']);
function ticWinner(b) {
  const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [x,y,z] of L) if (b[x] && b[x] === b[y] && b[y] === b[z]) return [x,y,z];
  return null;
}
function connect4Win(b, idx) {
  const r0 = Math.floor(idx/7), c0 = idx%7, s = b[idx];
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    let count = 1;
    for (const sign of [1,-1]) {
      let r = r0+dr*sign, c = c0+dc*sign;
      while (r>=0&&r<6&&c>=0&&c<7&&b[r*7+c]===s) { count++; r+=dr*sign; c+=dc*sign; }
    }
    if (count>=4) return true;
  }
  return false;
}
function makeMath(round) {
  const lvl = Math.min(6, Math.floor(round/3));
  const ops = lvl < 2 ? ['+','-'] : ['+','-','×'];
  const op = ops[Math.floor(Math.random()*ops.length)];
  let a,b;
  if (op==='×') { a=2+Math.floor(Math.random()*(6+lvl)); b=2+Math.floor(Math.random()*(6+lvl)); }
  else { a=5+Math.floor(Math.random()*(15+lvl*6)); b=1+Math.floor(Math.random()*(15+lvl*5)); if(op==='-'&&b>a)[a,b]=[b,a]; }
  const answer = op==='+'?a+b:op==='-'?a-b:a*b;
  return { text: `${a} ${op} ${b}`, answer };
}
