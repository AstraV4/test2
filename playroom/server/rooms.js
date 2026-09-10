import { customAlphabet } from 'nanoid';
import { pickImposterWord, IMPOSTER_THEME_LIST, DRAW_WORDS, buildPartyRound, BLUFF_QA, CAPTION_PROMPTS, QUIZ, WYR_SUGGEST, COUPLE_QUESTIONS, COUPLE_FLIRT, BAC_CATEGORIES, BAC_LETTERS, ASSOC_STARTERS, NOUS_PROMPTS, RATE_SUBJECTS, GUESS_RATINGS, ASK_SUGGEST } from './gamedata.js';
import { recordDuoPlay } from './db.js';

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
        quiz: d.quiz ? { q: d.quiz.q, options: d.quiz.options, cat: d.quiz.cat } : null,
        text: (d.game === 'typerace') ? d.text : null,
        sticks: (d.game === 'nim') ? d.sticks : null,
        memo: (d.game === 'memoduel') ? { cols: 4, matched: d.matched, pairs: d.pairs, faceUp: memoFaceUp(d) } : null,
        dots: (d.game === 'dots') ? { rows: 3, cols: 3, h: d.h, v: d.v, owners: d.owners, counts: d.counts } : null,
      };
    }
    if (room.gameType === 'wyrduel' && room.wyr) {
      const w = room.wyr;
      base.wyr = {
        askerId: w.asker, chooserId: w.chooser,
        round: room.wyrRound || 0, total: room.wyrTotal || 0, matches: room.wyrMatches || 0,
        prompt: room.phase !== 'wyrWrite' ? w.prompt : null,
        options: room.phase !== 'wyrWrite' ? w.options : null,
        suggestion: w.suggestion || null,
        reveal: (room.phase === 'wyrReveal' || room.phase === 'wyrOver') ? w.reveal : null,
      };
    }
    if (room.gameType === 'nbduel' && room.nb) {
      const n = room.nb;
      base.nb = {
        ready: Object.fromEntries(n.p.map(id => [id, n.secret[id] != null])),
        histories: n.histories, winnerId: n.winnerId || null,
      };
    }
    if (room.gameType === 'wordduel' && room.word2) {
      const w = room.word2;
      base.word2 = {
        ready: Object.fromEntries(w.p.map(id => [id, w.secret[id] != null])),
        views: w.views, errors: w.errors, tried: w.tried, lens: w.lens, maxErrors: w.maxErrors, winnerId: w.winnerId || null,
      };
    }
    if (room.gameType === 'coupleduo' && room.couple) {
      const c = room.couple;
      base.couple = {
        round: room.coupleRound || 0, total: room.coupleTotal || 0, matches: room.coupleMatches || 0,
        question: c.question, options: c.options,
        answeredIds: Object.keys(c.answers || {}),
        reveal: (room.phase === 'coupleReveal' || room.phase === 'coupleOver') ? c.reveal : null,
        result: room.coupleResult || null,
      };
    }
    if (room.gameType === 'bacduel' && room.bac) {
      const bc = room.bac;
      base.bac = {
        letter: bc.letter, categories: bc.categories, durationSec: bc.durationSec,
        round: room.bacRound || 0, total: room.bacTotal || 0, scores: bc.scores,
        submitted: Object.keys(bc.answers || {}),
        reveal: (room.phase === 'bacReveal') ? bc.reveal : null,
      };
    }
    if (room.gameType === 'twolies' && room.tl) {
      const t = room.tl;
      base.tl = {
        phase: room.phase, round: room.tlRound || 0, total: room.tlTotal || 0, scores: t.scores,
        tellerId: t.teller, statements: (room.phase === 'tlGuess' || room.phase === 'tlReveal') ? t.shuffled : null,
        writtenIds: Object.keys(t.written || {}), guess: t.guess != null ? true : false,
        reveal: (room.phase === 'tlReveal') ? t.reveal : null,
      };
    }
    if (room.gameType === 'assoc' && room.assoc) {
      const A = room.assoc;
      base.assoc = { round: room.assRound || 0, total: room.assTotal || 0, current: A.current, turnId: A.turn, chain: A.chain, matches: room.assMatches || 0, reveal: (room.phase === 'assReveal') ? A.reveal : null, result: room.assResult || null };
    }
    if (room.gameType === 'nousquiz' && room.nq) {
      const N = room.nq;
      base.nq = {
        phase: room.phase, round: room.nqRound || 0, total: room.nqTotal || 0, scores: N.scores,
        askerId: N.asker, prompt: N.prompt, question: (room.phase !== 'nqWrite') ? N.question : null,
        options: (room.phase === 'nqGuess' || room.phase === 'nqReveal') ? N.options : null,
        reveal: (room.phase === 'nqReveal') ? N.reveal : null,
      };
    }
    if (room.gameType === 'rateduo' && room.rate) {
      const R = room.rate;
      base.rate = {
        phase: room.phase, round: room.rateRound || 0, total: room.rateTotal || 0,
        proposerId: R.proposer, subject: (room.phase !== 'rateWrite') ? R.subject : null,
        suggestion: R.suggestion, ratedIds: Object.keys(R.notes || {}),
        reveal: (room.phase === 'rateReveal') ? R.reveal : null, matches: room.rateMatches || 0, result: room.rateResult || null,
      };
    }
    if (room.gameType === 'guessnote' && room.gn) {
      const G = room.gn;
      base.gn = {
        phase: room.phase, round: room.gnRound || 0, total: room.gnTotal || 0, scores: G.scores,
        hinterId: G.hinter, subject: G.subject, clues: G.clues,
        guessed: G.guess != null, reveal: (room.phase === 'gnReveal') ? G.reveal : null,
      };
    }
    if (room.gameType === 'askduo' && room.ask) {
      const A = room.ask;
      base.ask = {
        phase: room.phase, round: room.askRound || 0, total: room.askTotal || 0,
        askerId: A.asker, suggestion: A.suggestion,
        question: (room.phase !== 'askWrite') ? A.question : null,
        history: A.history || [],
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
      settings: { imposters: 1, discussionSec: 90, rounds: 1, theme: 'Aléatoire', drawSec: 75, drawRounds: 1, partyRounds: 8, bluffRounds: 5, captionRounds: 5, wyrRounds: 8, coupleRounds: 10, coupleMode: 'mignon' },
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
    if (['imposter', 'draw', 'party', 'bluff', 'caption', 'morpion', 'connect4', 'rps', 'reflexduel', 'mathduel', 'quizduel', 'typerace', 'nim', 'memoduel', 'dots', 'wyrduel', 'nbduel', 'wordduel', 'coupleduo', 'bacduel', 'twolies', 'assoc', 'nousquiz', 'rateduo', 'guessnote', 'askduo'].includes(type)) { room.gameType = type; this.emitRoom(room); this._touchActivity(room); }
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
    if (settings.wyrRounds != null) s.wyrRounds = clamp(parseInt(settings.wyrRounds, 10) || s.wyrRounds, 4, 20);
    if (settings.coupleRounds != null) s.coupleRounds = clamp(parseInt(settings.coupleRounds, 10) || s.coupleRounds, 5, 15);
    if (settings.coupleMode != null && ['mignon','flirt','mix'].includes(settings.coupleMode)) s.coupleMode = settings.coupleMode;
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
    const isDuel = ['morpion', 'connect4', 'rps', 'reflexduel', 'mathduel', 'quizduel', 'typerace', 'nim', 'memoduel', 'dots', 'wyrduel', 'nbduel', 'wordduel', 'coupleduo', 'bacduel', 'twolies', 'assoc', 'nousquiz', 'rateduo', 'guessnote', 'askduo'].includes(room.gameType);
    if (isDuel) { if (room.players.length !== 2) return socket.emit('room:error', { message: 'Ce jeu se joue exactement à 2 joueurs.' }); }
    else if (room.players.length < 3) return socket.emit('room:error', { message: 'Il faut au moins 3 joueurs.' });
    if (room.gameType === 'draw') this._beginDraw(room);
    else if (room.gameType === 'party') this._beginParty(room);
    else if (room.gameType === 'bluff') this._beginBluff(room);
    else if (room.gameType === 'caption') this._beginCaption(room);
    else if (room.gameType === 'wyrduel') { this._beginWyr(room); }
    else if (room.gameType === 'nbduel') { this._beginNb(room); }
    else if (room.gameType === 'wordduel') { this._beginWord(room); }
    else if (room.gameType === 'coupleduo') { this._beginCouple(room); }
    else if (room.gameType === 'bacduel') { this._beginBac(room); }
    else if (room.gameType === 'twolies') { this._beginTwoLies(room); }
    else if (room.gameType === 'assoc') { this._beginAssoc(room); }
    else if (room.gameType === 'nousquiz') { this._beginNous(room); }
    else if (room.gameType === 'rateduo') { this._beginRate(room); }
    else if (room.gameType === 'guessnote') { this._beginGuessNote(room); }
    else if (room.gameType === 'askduo') { this._beginAsk(room); }
    else if (DUEL_GAMES.has(room.gameType)) { this._beginDuel(room); }
    else this._beginRound(room);
    if (isDuel) this._recordDuo(room);
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
    if (room.gameType === 'wyrduel') { this._nextWyr(room); return; }
    if (room.gameType === 'nbduel') { if (room.phase === 'nbOver') this._beginNb(room); return; }
    if (room.gameType === 'wordduel') { if (room.phase === 'wordOver') this._beginWord(room); return; }
    if (room.gameType === 'coupleduo') { this._nextCouple(room); return; }
    if (room.gameType === 'bacduel') { this._nextBac(room); return; }
    if (room.gameType === 'twolies') { this._nextTwoLies(room); return; }
    if (room.gameType === 'assoc') { this._nextAssoc(room); return; }
    if (room.gameType === 'nousquiz') { this._nextNous(room); return; }
    if (room.gameType === 'rateduo') { this._nextRate(room); return; }
    if (room.gameType === 'guessnote') { this._nextGuessNote(room); return; }
    if (room.gameType === 'askduo') { this._nextAsk(room); return; }
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
    room.duel = null; room.wyr = null; room.nb = null; room.word2 = null; room.couple = null; room.bac = null; room.tl = null; room.assoc = null; room.nq = null; room.rate = null; room.gn = null; room.ask = null;
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
    const TARGETS = { reflexduel: 5, mathduel: 5, quizduel: 5, typerace: 3, nim: 2, morpion: 3, connect4: 3, rps: 3, memoduel: 999, dots: 999 };
    const target = TARGETS[room.gameType] || 3;
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
    else if (d.game === 'quizduel') { const q = QUIZ[Math.floor(Math.random() * QUIZ.length)]; d.quiz = { q: q.q, options: q.a, c: q.c, cat: q.cat }; d.turn = null; }
    else if (d.game === 'typerace') { d.text = TYPE_TEXTS[Math.floor(Math.random() * TYPE_TEXTS.length)]; d.turn = null; }
    else if (d.game === 'nim') { d.sticks = 15; d.turn = starter; }
    else if (d.game === 'memoduel') { const vals = []; for (let i = 1; i <= 8; i++) { vals.push(i, i); } shuffle(vals); d.deck = vals; d.matched = Array(16).fill(false); d.flipped = []; d.locked = false; d.pairs = { [a]: 0, [b]: 0 }; d.turn = starter; }
    else if (d.game === 'dots') { d.h = Array(12).fill(false); d.v = Array(12).fill(false); d.owners = Array(9).fill(null); d.counts = { [a]: 0, [b]: 0 }; d.turn = starter; }
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

  _duelEndMatch(room, winnerId) {
    const d = room.duel; if (!d) return;
    d.matchOver = true; d.winnerId = winnerId; d.roundOver = true; room.phase = 'duelOver';
    this._clearTimer(room);
    this.io.to(room.code).emit('duel:over', { winnerId });
    this.emitRoom(room);
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

  duelQuiz(socket, choice) {
    const room = this._room(socket); const d = room?.duel; if (!room || !d || d.game !== 'quizduel' || room.phase !== 'duel' || d.roundOver) return;
    const me = this._me(room, socket); if (!me) return;
    if (parseInt(choice, 10) === d.quiz.c) this._duelWin(room, me.id);
  }
  duelType(socket, text) {
    const room = this._room(socket); const d = room?.duel; if (!room || !d || d.game !== 'typerace' || room.phase !== 'duel' || d.roundOver) return;
    const me = this._me(room, socket); if (!me) return;
    if (String(text || '').trim() === String(d.text).trim()) this._duelWin(room, me.id);
  }
  duelTake(socket, n) {
    const room = this._room(socket); const d = room?.duel; if (!room || !d || d.game !== 'nim' || room.phase !== 'duel' || d.roundOver) return;
    const me = this._me(room, socket); if (!me || me.id !== d.turn) return;
    const k = parseInt(n, 10); if (!(k >= 1 && k <= 3) || k > d.sticks) return;
    d.sticks -= k;
    if (d.sticks <= 0) { const opp = d.p.find(x => x !== me.id); return this._duelWin(room, opp); } // celui qui prend le dernier perd
    d.turn = d.p.find(x => x !== me.id); this.emitRoom(room);
  }
  duelFlip(socket, index) {
    const room = this._room(socket); const d = room?.duel; if (!room || !d || d.game !== 'memoduel' || room.phase !== 'duel' || d.matchOver) return;
    const me = this._me(room, socket); if (!me || me.id !== d.turn || d.locked) return;
    const i = parseInt(index, 10);
    if (!(i >= 0 && i < 16) || d.matched[i] || d.flipped.includes(i)) return;
    d.flipped.push(i);
    this.emitRoom(room);
    if (d.flipped.length === 2) {
      d.locked = true;
      const [x, y] = d.flipped;
      if (d.deck[x] === d.deck[y]) {
        d.matched[x] = true; d.matched[y] = true; d.pairs[me.id] = (d.pairs[me.id] || 0) + 1; d.scores[me.id] = d.pairs[me.id]; d.flipped = []; d.locked = false;
        if (d.matched.every(Boolean)) { const [a, b] = d.p; const w = d.pairs[a] === d.pairs[b] ? 'draw' : (d.pairs[a] > d.pairs[b] ? a : b); return this._duelEndMatch(room, w); }
        this.emitRoom(room);
      } else {
        room.memoTimer = setTimeout(() => { d.flipped = []; d.locked = false; d.turn = d.p.find(z => z !== me.id); this.emitRoom(room); }, 1200);
      }
    }
  }
  duelEdge(socket, payload) {
    const room = this._room(socket); const d = room?.duel; if (!room || !d || d.game !== 'dots' || room.phase !== 'duel' || d.matchOver) return;
    const me = this._me(room, socket); if (!me || me.id !== d.turn) return;
    const type = payload?.type, idx = parseInt(payload?.index, 10);
    const C = 3, R = 3;
    if (type === 'h') { if (!(idx >= 0 && idx < 12) || d.h[idx]) return; d.h[idx] = true; }
    else if (type === 'v') { if (!(idx >= 0 && idx < 12) || d.v[idx]) return; d.v[idx] = true; }
    else return;
    // vérifier les cases complétées
    const boxDone = (r, c) => d.h[r * C + c] && d.h[(r + 1) * C + c] && d.v[r * (C + 1) + c] && d.v[r * (C + 1) + c + 1];
    let completed = 0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const bi = r * C + c; if (!d.owners[bi] && boxDone(r, c)) { d.owners[bi] = me.id; d.counts[me.id] = (d.counts[me.id] || 0) + 1; d.scores[me.id] = d.counts[me.id]; completed++; } }
    if (d.h.every(Boolean) && d.v.every(Boolean)) { const [a, b] = d.p; const w = d.counts[a] === d.counts[b] ? 'draw' : (d.counts[a] > d.counts[b] ? a : b); return this._duelEndMatch(room, w); }
    if (completed === 0) d.turn = d.p.find(x => x !== me.id); // sinon on rejoue
    this.emitRoom(room);
  }

  /* ============================ « Tu préfères ? » (duo) ============================ */
  _beginWyr(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { const s = this.io.sockets.sockets.get(room.players.find(p => p.id === room.hostId)?.socketId); s?.emit('room:error', { message: 'Ce jeu se joue à 2 joueurs.' }); return; }
    room.wyrP = [ids[0], ids[1]];
    room.wyrRound = 0; room.wyrTotal = room.settings.wyrRounds; room.wyrMatches = 0;
    this._beginWyrRound(room);
  }
  _beginWyrRound(room) {
    this._clearTimer(room);
    room.wyrRound += 1;
    const asker = room.wyrP[(room.wyrRound - 1) % 2];
    const chooser = room.wyrP.find(x => x !== asker);
    const sug = WYR_SUGGEST[Math.floor(Math.random() * WYR_SUGGEST.length)];
    room.wyr = { asker, chooser, prompt: null, options: null, askerChoice: null, chooserChoice: null, reveal: null, suggestion: sug };
    room.phase = 'wyrWrite';
    this.emitRoom(room);
    this._setTimer(room, 120000, () => this._beginWyrRound(room)); // sécurité si le joueur reste inactif
  }
  wyrSubmit(socket, data) {
    const room = this._room(socket); const w = room?.wyr; if (!room || !w || room.phase !== 'wyrWrite') return;
    const me = this._me(room, socket); if (!me || me.id !== w.asker) return;
    const a = sanitizeClue(data?.optionA); const b = sanitizeClue(data?.optionB);
    if (!a || !b) return;
    w.options = [a, b];
    w.prompt = sanitizeChat(data?.prompt) || 'Tu préfères…';
    const c = parseInt(data?.choice, 10); w.askerChoice = (c === 0 || c === 1) ? c : 0; // choix secret de celui qui pose
    room.phase = 'wyrAnswer';
    this.emitRoom(room);
    this._setTimer(room, 45000, () => { if (w.chooserChoice == null) { w.chooserChoice = Math.round(Math.random()); this._wyrReveal(room); } });
  }
  wyrAnswer(socket, choice) {
    const room = this._room(socket); const w = room?.wyr; if (!room || !w || room.phase !== 'wyrAnswer') return;
    const me = this._me(room, socket); if (!me || me.id !== w.chooser) return;
    const c = parseInt(choice, 10); if (c !== 0 && c !== 1) return;
    w.chooserChoice = c;
    this._wyrReveal(room);
  }
  _wyrReveal(room) {
    this._clearTimer(room);
    const w = room.wyr; if (!w || w.reveal) return;
    const match = w.askerChoice === w.chooserChoice;
    if (match) room.wyrMatches += 1;
    w.reveal = { askerChoice: w.askerChoice, chooserChoice: w.chooserChoice, match, prompt: w.prompt, options: w.options };
    room.phase = 'wyrReveal';
    this.io.to(room.code).emit('wyr:reveal', w.reveal);
    this.emitRoom(room);
    this._setTimer(room, 6000, () => this._nextWyr(room));
  }
  _nextWyr(room) {
    this._clearTimer(room);
    if (room.wyrRound >= room.wyrTotal) { this._endWyr(room); return; }
    this._beginWyrRound(room);
  }
  _endWyr(room) {
    this._clearTimer(room);
    room.phase = 'wyrOver';
    const total = room.wyrRound || 0;
    const affinity = total ? Math.round((room.wyrMatches / total) * 100) : 0;
    room.wyrResult = { matches: room.wyrMatches, total, affinity };
    this.io.to(room.code).emit('wyr:over', room.wyrResult);
    this.emitRoom(room);
  }

  /* ============================ Deviner le NOMBRE (1000-9999) ============================ */
  _beginNb(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { this._duelNeed2(room); return; }
    room.nb = { p: ids, secret: {}, histories: { [ids[0]]: [], [ids[1]]: [] }, winnerId: null };
    room.phase = 'nbSetup';
    this.emitRoom(room);
  }
  nbSetSecret(socket, value) {
    const room = this._room(socket); const n = room?.nb; if (!room || !n || room.phase !== 'nbSetup') return;
    const me = this._me(room, socket); if (!me) return;
    const v = String(value || '').replace(/\D/g, '');
    if (v.length !== 4) { socket.emit('room:error', { message: 'Choisis un nombre à 4 chiffres.' }); return; }
    n.secret[me.id] = v;
    this.emitRoom(room);
    if (n.p.every(id => n.secret[id] != null)) { room.phase = 'nbPlay'; this.emitRoom(room); }
  }
  nbGuess(socket, value) {
    const room = this._room(socket); const n = room?.nb; if (!room || !n || room.phase !== 'nbPlay') return;
    const me = this._me(room, socket); if (!me || n.winnerId) return;
    const guess = String(value || '').replace(/\D/g, '');
    if (guess.length !== 4) return;
    const oppId = n.p.find(x => x !== me.id);
    const secret = n.secret[oppId];
    const { well, misplaced } = bullsCows(secret, guess);
    n.histories[me.id].push({ guess, well, misplaced });
    if (well === 4) { n.winnerId = me.id; room.phase = 'nbOver'; this.io.to(room.code).emit('nb:over', { winnerId: me.id, secrets: n.secret }); }
    this.emitRoom(room);
  }

  /* ============================ Deviner le MOT (façon pendu) ============================ */
  _beginWord(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { this._duelNeed2(room); return; }
    room.word2 = { p: ids, secret: {}, revealed: { [ids[0]]: new Set(), [ids[1]]: new Set() }, errors: { [ids[0]]: 0, [ids[1]]: 0 }, tried: { [ids[0]]: [], [ids[1]]: [] }, maxErrors: 8, winnerId: null };
    room.phase = 'wordSetup';
    this._word2Public(room);
    this.emitRoom(room);
  }
  wordSetSecret(socket, value) {
    const room = this._room(socket); const w = room?.word2; if (!room || !w || room.phase !== 'wordSetup') return;
    const me = this._me(room, socket); if (!me) return;
    const word = normWord(value);
    if (word.length < 3 || word.length > 12) { socket.emit('room:error', { message: 'Choisis un mot de 3 à 12 lettres.' }); return; }
    w.secret[me.id] = word;
    if (w.p.every(id => w.secret[id] != null)) { room.phase = 'wordPlay'; }
    this._word2Public(room); this.emitRoom(room);
  }
  wordLetter(socket, letter) {
    const room = this._room(socket); const w = room?.word2; if (!room || !w || room.phase !== 'wordPlay') return;
    const me = this._me(room, socket); if (!me || w.winnerId) return;
    const L = normWord(letter).slice(0, 1); if (!L) return;
    if (w.tried[me.id].includes(L)) return;
    w.tried[me.id].push(L);
    const oppId = w.p.find(x => x !== me.id);
    const secret = w.secret[oppId];
    if (secret.includes(L)) {
      w.revealed[me.id].add(L);
      // gagné si toutes les lettres du mot adverse sont révélées
      const allRevealed = [...new Set(secret.split(''))].every(ch => w.revealed[me.id].has(ch));
      if (allRevealed) { w.winnerId = me.id; room.phase = 'wordOver'; this.io.to(room.code).emit('word:over', { winnerId: me.id, secrets: w.secret }); }
    } else {
      w.errors[me.id] += 1;
      if (w.errors[me.id] >= w.maxErrors) { const opp = w.p.find(x => x !== me.id); w.winnerId = opp; room.phase = 'wordOver'; this.io.to(room.code).emit('word:over', { winnerId: opp, secrets: w.secret, reason: 'maxErrors' }); }
    }
    this._word2Public(room); this.emitRoom(room);
  }
  _word2Public(room) {
    const w = room.word2; if (!w) return;
    w.lens = {}; w.views = {};
    for (const id of w.p) {
      const oppId = w.p.find(x => x !== id);
      const secret = w.secret[oppId];
      w.lens[id] = secret ? secret.length : 0;
      w.views[id] = secret ? secret.split('').map(ch => (w.revealed[id].has(ch) ? ch : '_')).join('') : '';
    }
    // exposer tried/errors tels quels (déjà des tableaux/nombres)
  }

  /* ============================ Compatibilité (Duo / Couple) ============================ */
  _beginCouple(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { this._duelNeed2(room); return; }
    room.coupleP = ids; room.coupleUsed = new Set(); room.coupleRound = 0; room.coupleTotal = room.settings.coupleRounds; room.coupleMatches = 0;
    this._beginCoupleRound(room);
  }
  _beginCoupleRound(room) {
    this._clearTimer(room);
    room.coupleRound += 1;
    const mode = room.settings.coupleMode || 'mignon';
    const pool = mode === 'flirt' ? COUPLE_FLIRT : mode === 'mix' ? [...COUPLE_QUESTIONS, ...COUPLE_FLIRT] : COUPLE_QUESTIONS;
    let idx = Math.floor(Math.random() * pool.length);
    for (let i = 0; i < pool.length && room.coupleUsed.has(idx); i++) idx = (idx + 1) % pool.length;
    room.coupleUsed.add(idx);
    const q = pool[idx];
    room.couple = { question: q.q, options: q.options, answers: {}, reveal: null };
    room.phase = 'coupleAnswer';
    this.emitRoom(room);
    this._setTimer(room, 40000, () => this._coupleReveal(room));
  }
  coupleAnswer(socket, choice) {
    const room = this._room(socket); const c = room?.couple; if (!room || !c || room.phase !== 'coupleAnswer') return;
    const me = this._me(room, socket); if (!me) return;
    const i = parseInt(choice, 10); if (!(i >= 0 && i < c.options.length)) return;
    c.answers[me.id] = i;
    this.emitRoom(room);
    if (room.coupleP.every(id => c.answers[id] != null)) this._coupleReveal(room);
  }
  _coupleReveal(room) {
    this._clearTimer(room);
    const c = room.couple; if (!c || c.reveal) return;
    const [a, b] = room.coupleP;
    const match = c.answers[a] != null && c.answers[a] === c.answers[b];
    if (match) room.coupleMatches += 1;
    c.reveal = { answers: c.answers, match };
    room.phase = 'coupleReveal';
    this.io.to(room.code).emit('couple:reveal', c.reveal);
    this.emitRoom(room);
    this._setTimer(room, 6000, () => this._nextCouple(room));
  }
  _nextCouple(room) {
    this._clearTimer(room);
    if (room.coupleRound >= room.coupleTotal) { this._endCouple(room); return; }
    this._beginCoupleRound(room);
  }
  _endCouple(room) {
    this._clearTimer(room);
    room.phase = 'coupleOver';
    const total = room.coupleRound || 0;
    const affinity = total ? Math.round((room.coupleMatches / total) * 100) : 0;
    room.coupleResult = { matches: room.coupleMatches, total, affinity };
    this.io.to(room.code).emit('couple:over', room.coupleResult);
    this.emitRoom(room);
  }

  _recordDuo(room) {
    const socks = room.players.filter(p => p.connected).map(p => this.io.sockets.sockets.get(p.socketId));
    const uids = socks.map(s => s?.data?.userId).filter(Boolean);
    if (uids.length === 2) {
      try { const r = recordDuoPlay(uids[0], uids[1]); this.io.to(room.code).emit('duo:streak', r); } catch { /* ignore */ }
    }
  }
  /* ============================ Le Bac (petit bac) ============================ */
  _beginBac(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { this._duelNeed2(room); return; }
    room.bacP = ids; room.bacRound = 0; room.bacTotal = 3; room.bacScores = { [ids[0]]: 0, [ids[1]]: 0 };
    this._beginBacRound(room);
  }
  _beginBacRound(room) {
    this._clearTimer(room);
    room.bacRound += 1;
    const letter = BAC_LETTERS[Math.floor(Math.random() * BAC_LETTERS.length)];
    room.bac = { letter, categories: BAC_CATEGORIES, durationSec: 90, answers: {}, reveal: null, scores: room.bacScores };
    room.phase = 'bacPlay';
    this.emitRoom(room);
    this._setTimer(room, 92000, () => this._bacReveal(room)); // fin de manche auto (90s + marge)
  }
  bacSubmit(socket, answers) {
    const room = this._room(socket); const bc = room?.bac; if (!room || !bc || room.phase !== 'bacPlay') return;
    const me = this._me(room, socket); if (!me || bc.answers[me.id]) return;
    // nettoyage : une réponse par catégorie, bornée
    const clean = (Array.isArray(answers) ? answers : []).slice(0, bc.categories.length).map(a => sanitizeClue(a));
    bc.answers[me.id] = clean;
    this.emitRoom(room);
    if (room.bacP.every(id => bc.answers[id])) this._bacReveal(room);
  }
  _bacReveal(room) {
    this._clearTimer(room);
    const bc = room.bac; if (!bc || bc.reveal) return;
    const [a, b] = room.bacP;
    const ansA = bc.answers[a] || []; const ansB = bc.answers[b] || [];
    const L = bc.letter.toLowerCase();
    const rows = bc.categories.map((cat, i) => {
      const va = (ansA[i] || '').trim(); const vb = (ansB[i] || '').trim();
      const okA = !!va && norm(va).startsWith(norm(L));
      const okB = !!vb && norm(vb).startsWith(norm(L));
      // Points : 10 si valide et unique, 5 si valide mais identique à l'autre, 0 sinon
      const same = okA && okB && norm(va) === norm(vb);
      let pa = 0, pb = 0;
      if (okA) pa = same ? 5 : 10;
      if (okB) pb = same ? 5 : 10;
      room.bacScores[a] += pa; room.bacScores[b] += pb;
      return { cat, a: va, b: vb, okA, okB, same, pa, pb };
    });
    bc.reveal = { rows, letter: bc.letter, players: { [a]: room.players.find(p => p.id === a)?.name, [b]: room.players.find(p => p.id === b)?.name }, scores: room.bacScores, ids: [a, b] };
    room.phase = 'bacReveal';
    this.io.to(room.code).emit('bac:reveal', bc.reveal);
    this.emitRoom(room);
  }
  _nextBac(room) {
    this._clearTimer(room);
    if (room.bacRound >= room.bacTotal) { this._endBac(room); return; }
    this._beginBacRound(room);
  }
  _endBac(room) {
    this._clearTimer(room);
    room.phase = 'bacOver';
    const [a, b] = room.bacP;
    const winnerId = room.bacScores[a] === room.bacScores[b] ? 'draw' : (room.bacScores[a] > room.bacScores[b] ? a : b);
    room.bacResult = { scores: room.bacScores, winnerId, ids: [a, b] };
    this.io.to(room.code).emit('bac:over', room.bacResult);
    this.emitRoom(room);
  }

  /* ============================ Deux vérités, un mensonge ============================ */
  _beginTwoLies(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { this._duelNeed2(room); return; }
    room.tlP = ids; room.tlRound = 0; room.tlTotal = 6; room.tlScores = { [ids[0]]: 0, [ids[1]]: 0 };
    this._beginTLRound(room);
  }
  _beginTLRound(room) {
    this._clearTimer(room);
    room.tlRound += 1;
    const teller = room.tlP[(room.tlRound - 1) % 2];
    room.tl = { teller, shuffled: null, lieShuf: null, guess: null, reveal: null, scores: room.tlScores };
    room.phase = 'tlWrite';
    this.emitRoom(room);
  }
  tlWrite(socket, data) {
    const room = this._room(socket); const t = room?.tl; if (!room || !t || room.phase !== 'tlWrite') return;
    const me = this._me(room, socket); if (!me || me.id !== t.teller) return;
    const stmts = (Array.isArray(data?.statements) ? data.statements : []).map(x => sanitizeChat(x)).filter(Boolean);
    const lie = parseInt(data?.lie, 10);
    if (stmts.length !== 3 || !(lie === 0 || lie === 1 || lie === 2)) return;
    const order = shuffle([0, 1, 2]);
    t.shuffled = order.map(i => stmts[i]);
    t.lieShuf = order.indexOf(lie);
    room.phase = 'tlGuess';
    this.emitRoom(room);
    this._setTimer(room, 45000, () => { if (t.guess == null) { t.guess = Math.floor(Math.random() * 3); this._tlReveal(room); } });
  }
  tlGuess(socket, index) {
    const room = this._room(socket); const t = room?.tl; if (!room || !t || room.phase !== 'tlGuess') return;
    const me = this._me(room, socket); if (!me || me.id === t.teller) return;
    const i = parseInt(index, 10); if (!(i >= 0 && i < 3)) return;
    t.guess = i; this._tlReveal(room);
  }
  _tlReveal(room) {
    this._clearTimer(room);
    const t = room.tl; if (!t || t.reveal) return;
    const guesser = room.tlP.find(x => x !== t.teller);
    const correct = t.guess === t.lieShuf;
    if (correct) room.tlScores[guesser] += 1; else room.tlScores[t.teller] += 1;
    t.reveal = { statements: t.shuffled, lieIndex: t.lieShuf, guess: t.guess, correct };
    room.phase = 'tlReveal';
    this.io.to(room.code).emit('twolies:reveal', t.reveal);
    this.emitRoom(room);
    this._setTimer(room, 8000, () => this._nextTwoLies(room));
  }
  _nextTwoLies(room) { this._clearTimer(room); if (room.tlRound >= room.tlTotal) return this._endTwoLies(room); this._beginTLRound(room); }
  _endTwoLies(room) {
    this._clearTimer(room); room.phase = 'tlOver';
    const [a, b] = room.tlP; const w = room.tlScores[a] === room.tlScores[b] ? 'draw' : (room.tlScores[a] > room.tlScores[b] ? a : b);
    room.tlResult = { scores: room.tlScores, winnerId: w, ids: [a, b] };
    this.io.to(room.code).emit('twolies:over', room.tlResult);
    this.emitRoom(room);
  }

  /* ============================ Association d'idées (le mot qui suit) ============================ */
  _beginAssoc(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { this._duelNeed2(room); return; }
    room.assP = ids; room.assRound = 0; room.assTotal = 8; room.assMatches = 0;
    const start = ASSOC_STARTERS[Math.floor(Math.random() * ASSOC_STARTERS.length)];
    this._beginAssocRound(room, start);
  }
  _beginAssocRound(room, word) {
    this._clearTimer(room);
    room.assRound += 1;
    room.assoc = { current: word, answers: {}, reveal: null, chain: room.assoc?.chain || [] };
    room.phase = 'assPlay';
    this.emitRoom(room);
    this._setTimer(room, 7000, () => this._assReveal(room));
  }
  assAnswer(socket, word) {
    const room = this._room(socket); const A = room?.assoc; if (!room || !A || room.phase !== 'assPlay') return;
    const me = this._me(room, socket); if (!me || A.answers[me.id] != null) return;
    A.answers[me.id] = sanitizeClue(word);
    this.emitRoom(room);
    if (room.assP.every(id => A.answers[id] != null)) this._assReveal(room);
  }
  _assReveal(room) {
    this._clearTimer(room);
    const A = room.assoc; if (!A || A.reveal) return;
    const [a, b] = room.assP; const va = A.answers[a] || ''; const vb = A.answers[b] || '';
    const match = !!va && norm(va) === norm(vb);
    if (match) room.assMatches += 1;
    A.reveal = { word: A.current, a: va, b: vb, match, names: { [a]: room.players.find(p => p.id === a)?.name, [b]: room.players.find(p => p.id === b)?.name } };
    A.chain = [...(A.chain || []), { word: A.current, a: va, b: vb, match }];
    room.phase = 'assReveal';
    this.io.to(room.code).emit('assoc:reveal', A.reveal);
    this.emitRoom(room);
    this._setTimer(room, 4000, () => {
      if (room.assRound >= room.assTotal) return this._endAssoc(room);
      const next = match ? va : (va || vb || ASSOC_STARTERS[Math.floor(Math.random() * ASSOC_STARTERS.length)]);
      this._beginAssocRound(room, next);
    });
  }
  _endAssoc(room) {
    this._clearTimer(room); room.phase = 'assOver';
    const total = room.assRound || 0; const affinity = total ? Math.round((room.assMatches / total) * 100) : 0;
    room.assResult = { matches: room.assMatches, total, affinity, chain: room.assoc?.chain || [] };
    this.io.to(room.code).emit('assoc:over', room.assResult);
    this.emitRoom(room);
  }
  _nextAssoc(room) {
    if (room.phase !== 'assReveal') return; // l'enchaînement auto gère le reste
    this._clearTimer(room);
    if (room.assRound >= room.assTotal) return this._endAssoc(room);
    const A = room.assoc; const va = A?.reveal?.a || ''; const vb = A?.reveal?.b || '';
    const next = (A?.reveal?.match ? va : (va || vb)) || ASSOC_STARTERS[Math.floor(Math.random() * ASSOC_STARTERS.length)];
    this._beginAssocRound(room, next);
  }

  /* ============================ Quiz "spécial nous" ============================ */
  _beginNous(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { this._duelNeed2(room); return; }
    room.nqP = ids; room.nqRound = 0; room.nqTotal = 6; room.nqScores = { [ids[0]]: 0, [ids[1]]: 0 };
    this._beginNousRound(room);
  }
  _beginNousRound(room) {
    this._clearTimer(room);
    room.nqRound += 1;
    const asker = room.nqP[(room.nqRound - 1) % 2];
    const prompt = NOUS_PROMPTS[Math.floor(Math.random() * NOUS_PROMPTS.length)];
    room.nq = { asker, prompt, question: null, options: null, correctShuf: null, guess: null, reveal: null, scores: room.nqScores };
    room.phase = 'nqWrite';
    this.emitRoom(room);
  }
  nqWrite(socket, data) {
    const room = this._room(socket); const N = room?.nq; if (!room || !N || room.phase !== 'nqWrite') return;
    const me = this._me(room, socket); if (!me || me.id !== N.asker) return;
    const q = sanitizeChat(data?.question) || N.prompt;
    const opts = (Array.isArray(data?.options) ? data.options : []).map(x => sanitizeClue(x)).filter(Boolean).slice(0, 4);
    const correct = parseInt(data?.correct, 10);
    if (opts.length < 2 || !(correct >= 0 && correct < opts.length)) return;
    const order = shuffle(opts.map((_, i) => i));
    N.question = q; N.options = order.map(i => opts[i]); N.correctShuf = order.indexOf(correct);
    room.phase = 'nqGuess';
    this.emitRoom(room);
    this._setTimer(room, 40000, () => { if (N.guess == null) { N.guess = Math.floor(Math.random() * N.options.length); this._nqReveal(room); } });
  }
  nqGuess(socket, index) {
    const room = this._room(socket); const N = room?.nq; if (!room || !N || room.phase !== 'nqGuess') return;
    const me = this._me(room, socket); if (!me || me.id === N.asker) return;
    const i = parseInt(index, 10); if (!(i >= 0 && i < N.options.length)) return;
    N.guess = i; this._nqReveal(room);
  }
  _nqReveal(room) {
    this._clearTimer(room);
    const N = room.nq; if (!N || N.reveal) return;
    const guesser = room.nqP.find(x => x !== N.asker);
    const correct = N.guess === N.correctShuf;
    if (correct) room.nqScores[guesser] += 1;
    N.reveal = { question: N.question, options: N.options, correct: N.correctShuf, guess: N.guess, ok: correct, askerName: room.players.find(p => p.id === N.asker)?.name };
    room.phase = 'nqReveal';
    this.io.to(room.code).emit('nousquiz:reveal', N.reveal);
    this.emitRoom(room);
    this._setTimer(room, 7000, () => this._nextNous(room));
  }
  _nextNous(room) { this._clearTimer(room); if (room.nqRound >= room.nqTotal) return this._endNous(room); this._beginNousRound(room); }
  _endNous(room) {
    this._clearTimer(room); room.phase = 'nqOver';
    const [a, b] = room.nqP; const total = room.nqRound || 0;
    const affinity = total ? Math.round(((room.nqScores[a] + room.nqScores[b]) / (total)) * 100) : 0;
    room.nqResult = { scores: room.nqScores, ids: [a, b], affinity };
    this.io.to(room.code).emit('nousquiz:over', room.nqResult);
    this.emitRoom(room);
  }

  /* ============================ "Note ça" (sujets choisis par les joueurs) ============================ */
  _beginRate(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { this._duelNeed2(room); return; }
    room.rateP = ids; room.rateRound = 0; room.rateTotal = 8; room.rateMatches = 0;
    this._beginRateRound(room);
  }
  _beginRateRound(room) {
    this._clearTimer(room);
    room.rateRound += 1;
    const proposer = room.rateP[(room.rateRound - 1) % 2];
    const suggestion = RATE_SUBJECTS[Math.floor(Math.random() * RATE_SUBJECTS.length)];
    room.rate = { proposer, subject: null, suggestion, notes: {}, reveal: null };
    room.phase = 'rateWrite';
    this.emitRoom(room);
  }
  rateSubject(socket, subject) {
    const room = this._room(socket); const R = room?.rate; if (!room || !R || room.phase !== 'rateWrite') return;
    const me = this._me(room, socket); if (!me || me.id !== R.proposer) return;
    const subj = sanitizeChat(subject) || R.suggestion;
    R.subject = subj; room.phase = 'rateScore';
    this.emitRoom(room);
    this._setTimer(room, 45000, () => this._rateReveal(room));
  }
  rateNote(socket, note) {
    const room = this._room(socket); const R = room?.rate; if (!room || !R || room.phase !== 'rateScore') return;
    const me = this._me(room, socket); if (!me || R.notes[me.id] != null) return;
    const n = Math.max(0, Math.min(10, parseInt(note, 10)));
    if (Number.isNaN(n)) return;
    R.notes[me.id] = n;
    this.emitRoom(room);
    if (room.rateP.every(id => R.notes[id] != null)) this._rateReveal(room);
  }
  _rateReveal(room) {
    this._clearTimer(room);
    const R = room.rate; if (!R || R.reveal) return;
    const [a, b] = room.rateP; const na = R.notes[a] ?? null; const nb = R.notes[b] ?? null;
    const diff = (na != null && nb != null) ? Math.abs(na - nb) : 10;
    if (diff <= 1) room.rateMatches += 1; // notes proches = accord
    R.reveal = { subject: R.subject, notes: { [a]: na, [b]: nb }, diff, names: { [a]: room.players.find(p => p.id === a)?.name, [b]: room.players.find(p => p.id === b)?.name }, ids: [a, b] };
    room.phase = 'rateReveal';
    this.io.to(room.code).emit('rate:reveal', R.reveal);
    this.emitRoom(room);
    this._setTimer(room, 6000, () => this._nextRate(room));
  }
  _nextRate(room) { this._clearTimer(room); if (room.rateRound >= room.rateTotal) return this._endRate(room); this._beginRateRound(room); }
  _endRate(room) {
    this._clearTimer(room); room.phase = 'rateOver';
    const total = room.rateRound || 0; const affinity = total ? Math.round((room.rateMatches / total) * 100) : 0;
    room.rateResult = { matches: room.rateMatches, total, affinity };
    this.io.to(room.code).emit('rate:over', room.rateResult);
    this.emitRoom(room);
  }

  /* ============================ "Devine la note" (le site note, on fait deviner) ============================ */
  _beginGuessNote(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { this._duelNeed2(room); return; }
    room.gnP = ids; room.gnRound = 0; room.gnTotal = 6; room.gnScores = { [ids[0]]: 0, [ids[1]]: 0 }; room.gnUsed = new Set();
    this._beginGNRound(room);
  }
  _beginGNRound(room) {
    this._clearTimer(room);
    room.gnRound += 1;
    const hinter = room.gnP[(room.gnRound - 1) % 2];
    let idx = Math.floor(Math.random() * GUESS_RATINGS.length);
    for (let i = 0; i < GUESS_RATINGS.length && room.gnUsed.has(idx); i++) idx = (idx + 1) % GUESS_RATINGS.length;
    room.gnUsed.add(idx);
    const item = GUESS_RATINGS[idx];
    room.gn = { hinter, subject: item.subject, note: item.note, clues: [], guess: null, reveal: null, scores: room.gnScores };
    room.phase = 'gnHint';
    // note secrète envoyée uniquement au donneur d'indices
    const hs = this._sockOf(room, hinter);
    if (hs) this.io.to(hs).emit('gn:secret', { note: item.note, subject: item.subject });
    this.emitRoom(room);
  }
  gnClue(socket, text) {
    const room = this._room(socket); const G = room?.gn; if (!room || !G || room.phase !== 'gnHint') return;
    const me = this._me(room, socket); if (!me || me.id !== G.hinter) return;
    const clue = sanitizeClue(text); if (!clue) return;
    // interdit d'écrire un chiffre (sinon c'est trop facile)
    if (/\d/.test(clue)) { socket.emit('room:error', { message: 'Pas de chiffres dans les indices !' }); return; }
    G.clues.push(clue);
    this.emitRoom(room);
    if (G.clues.length >= 3) { room.phase = 'gnGuess'; this.emitRoom(room); this._setTimer(room, 30000, () => { if (G.guess == null) { G.guess = 5; this._gnReveal(room); } }); }
  }
  gnReady(socket) { // le donneur passe à la devinette avant 3 indices
    const room = this._room(socket); const G = room?.gn; if (!room || !G || room.phase !== 'gnHint') return;
    const me = this._me(room, socket); if (!me || me.id !== G.hinter || G.clues.length === 0) return;
    room.phase = 'gnGuess'; this.emitRoom(room);
    this._setTimer(room, 30000, () => { if (G.guess == null) { G.guess = 5; this._gnReveal(room); } });
  }
  gnGuess(socket, note) {
    const room = this._room(socket); const G = room?.gn; if (!room || !G || room.phase !== 'gnGuess') return;
    const me = this._me(room, socket); if (!me || me.id === G.hinter) return;
    const n = Math.max(0, Math.min(10, parseInt(note, 10))); if (Number.isNaN(n)) return;
    G.guess = n; this._gnReveal(room);
  }
  _gnReveal(room) {
    this._clearTimer(room);
    const G = room.gn; if (!G || G.reveal) return;
    const diff = Math.abs((G.guess ?? 5) - G.note);
    const pts = diff === 0 ? 3 : diff === 1 ? 2 : diff === 2 ? 1 : 0; // proche = plus de points
    const guesser = room.gnP.find(x => x !== G.hinter);
    room.gnScores[guesser] += pts;
    G.reveal = { subject: G.subject, note: G.note, guess: G.guess, diff, pts, clues: G.clues, guesserName: room.players.find(p => p.id === guesser)?.name };
    room.phase = 'gnReveal';
    this.io.to(room.code).emit('gn:reveal', G.reveal);
    this.emitRoom(room);
    this._setTimer(room, 8000, () => this._nextGuessNote(room));
  }
  _nextGuessNote(room) { this._clearTimer(room); if (room.gnRound >= room.gnTotal) return this._endGuessNote(room); this._beginGNRound(room); }
  _endGuessNote(room) {
    this._clearTimer(room); room.phase = 'gnOver';
    const [a, b] = room.gnP; const w = room.gnScores[a] === room.gnScores[b] ? 'draw' : (room.gnScores[a] > room.gnScores[b] ? a : b);
    room.gnResult = { scores: room.gnScores, winnerId: w, ids: [a, b] };
    this.io.to(room.code).emit('gn:over', room.gnResult);
    this.emitRoom(room);
  }

  /* ============================ "Balance tout" (questions libres, on répond) ============================ */
  _beginAsk(room) {
    const ids = room.players.filter(p => p.connected).map(p => p.id);
    if (ids.length !== 2) { this._duelNeed2(room); return; }
    room.askP = ids; room.askRound = 0; room.askTotal = 10; room.askHistory = [];
    this._beginAskRound(room);
  }
  _beginAskRound(room) {
    this._clearTimer(room);
    room.askRound += 1;
    const asker = room.askP[(room.askRound - 1) % 2];
    const suggestion = ASK_SUGGEST[Math.floor(Math.random() * ASK_SUGGEST.length)];
    room.ask = { asker, suggestion, question: null, history: room.askHistory };
    room.phase = 'askWrite';
    this.emitRoom(room);
  }
  askQuestion(socket, text) {
    const room = this._room(socket); const A = room?.ask; if (!room || !A || room.phase !== 'askWrite') return;
    const me = this._me(room, socket); if (!me || me.id !== A.asker) return;
    const q = sanitizeChat(text) || A.suggestion;
    A.question = q;
    room.phase = 'askAnswer';
    this.emitRoom(room);
  }
  askAnswer(socket, text) {
    const room = this._room(socket); const A = room?.ask; if (!room || !A || room.phase !== 'askAnswer') return;
    const me = this._me(room, socket); if (!me || me.id === A.asker) return; // seul le destinataire répond
    const ans = sanitizeChat(text); if (!ans) return;
    const askerName = room.players.find(p => p.id === A.asker)?.name;
    const answererName = me.name;
    room.askHistory = [...(room.askHistory || []), { question: A.question, answer: ans, askerName, answererName }];
    A.history = room.askHistory;
    this.io.to(room.code).emit('ask:answered', { question: A.question, answer: ans, askerName, answererName });
    room.phase = 'askReveal';
    this.emitRoom(room);
    this._setTimer(room, 6000, () => this._nextAsk(room));
  }
  _nextAsk(room) { this._clearTimer(room); if (room.askRound >= room.askTotal) return this._endAsk(room); this._beginAskRound(room); }
  _endAsk(room) {
    this._clearTimer(room); room.phase = 'askOver';
    room.askResult = { count: (room.askHistory || []).length, history: room.askHistory || [] };
    this.io.to(room.code).emit('ask:over', room.askResult);
    this.emitRoom(room);
  }

  _duelNeed2(room) { const s = this.io.sockets.sockets.get(room.players.find(p => p.id === room.hostId)?.socketId); s?.emit('room:error', { message: 'Ce jeu se joue à 2 joueurs.' }); }

  /* ============================ CHAT ============================ */
  _chatAllowed(room) {
    if (room.gameType === 'draw') return true; // le chat sert aussi à deviner
    if (room.gameType === 'party' || room.gameType === 'bluff' || room.gameType === 'caption') return true; // social
    if (DUEL_GAMES.has(room.gameType) || ['wyrduel','nbduel','wordduel','coupleduo','bacduel','twolies','assoc','nousquiz','rateduo','guessnote','askduo'].includes(room.gameType)) return true; // 1v1 : chat libre
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
    this.io.to(room.code).emit('chat:msg', { playerId: me.id, userId: socket.data?.userId || null, name: me.name, avatar: me.avatar, text: msg, ts: now });
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
    if (['wyrduel','nbduel','wordduel','coupleduo','bacduel','twolies','assoc','nousquiz','rateduo','guessnote','askduo'].includes(room.gameType) && room.phase !== 'lobby') { this._clearTimer(room); room.phase = 'lobby'; room.wyr = null; room.nb = null; room.word2 = null; room.couple = null; room.bac = null; room.tl = null; room.assoc = null; room.nq = null; room.rate = null; room.gn = null; room.ask = null; room.ask = null; room.rate = null; room.gn = null; room.ask = null; room.tl = null; room.assoc = null; room.nq = null; room.rate = null; room.gn = null; room.ask = null; this.io.to(room.code).emit('game:toLobby'); this.emitRoom(room); return; }
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
  _clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } if (room.hintTimer) { clearTimeout(room.hintTimer); room.hintTimer = null; } if (room.duelTimer) { clearTimeout(room.duelTimer); room.duelTimer = null; } if (room.duelGoTimer) { clearTimeout(room.duelGoTimer); room.duelGoTimer = null; } if (room.memoTimer) { clearTimeout(room.memoTimer); room.memoTimer = null; } room.endsAt = null; }
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

const DUEL_GAMES = new Set(['morpion', 'connect4', 'rps', 'reflexduel', 'mathduel', 'quizduel', 'typerace', 'nim', 'memoduel', 'dots']);
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

const TYPE_TEXTS = [
  'Le renard rapide saute par-dessus le chien.',
  'Jouer en duel demande vitesse et précision.',
  'La victoire appartient au plus concentré.',
  'Chaque seconde compte dans une course de frappe.',
  'Reste calme, tape juste, et gagne la manche.',
];
function memoFaceUp(d) {
  const out = {};
  for (let i = 0; i < 16; i++) if (d.matched[i] || (d.flipped && d.flipped.includes(i))) out[i] = d.deck[i];
  return out;
}

function bullsCows(secret, guess) {
  let well = 0; const sRem = [], gRem = [];
  for (let i = 0; i < 4; i++) { if (secret[i] === guess[i]) well++; else { sRem.push(secret[i]); gRem.push(guess[i]); } }
  let misplaced = 0; const pool = {};
  for (const d of sRem) pool[d] = (pool[d] || 0) + 1;
  for (const d of gRem) if (pool[d] > 0) { misplaced++; pool[d]--; }
  return { well, misplaced };
}
function normWord(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, ''); }
