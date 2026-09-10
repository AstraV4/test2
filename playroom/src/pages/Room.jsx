import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Crown, LogOut, Play, Check, X, Settings, UserX, Share2, Wifi, WifiOff, UserPlus2, Gamepad2, Users2, MessageCircle } from 'lucide-react';
import { getSocket } from '../lib/socket.js';
import { Card, Button, Avatar, Tag, Spinner } from '../components/ui/index.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFriends } from '../context/FriendsContext.jsx';
import Imposter from '../games/imposter/Imposter.jsx';
import DrawGuess from '../games/draw/DrawGuess.jsx';
import Party from '../games/party/Party.jsx';
import Bluff from '../games/bluff/Bluff.jsx';
import Caption from '../games/caption/Caption.jsx';
import Duel from '../games/duel/Duel.jsx';
import Wyr from '../games/wyr/Wyr.jsx';
import NumberDuel from '../games/numberduel/NumberDuel.jsx';
import WordDuel from '../games/wordduel/WordDuel.jsx';
import Couple from '../games/couple/Couple.jsx';
import Bac from '../games/bac/Bac.jsx';
import TwoLies from '../games/twolies/TwoLies.jsx';
import Assoc from '../games/assoc/Assoc.jsx';
import NousQuiz from '../games/nousquiz/NousQuiz.jsx';
import Rate from '../games/rate/Rate.jsx';
import GuessNote from '../games/guessnote/GuessNote.jsx';
import Ask from '../games/ask/Ask.jsx';
import Chat from '../components/Chat.jsx';
import PartyMode from '../components/PartyMode.jsx';
import { gameById } from '../games/registry.js';
import { sound } from '../lib/sound.js';

const DUEL_TYPES = ['morpion', 'connect4', 'rps', 'reflexduel', 'mathduel', 'quizduel', 'typerace', 'nim', 'memoduel', 'dots'];

export default function Room() {
  const { code: codeParam } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [endsAt, setEndsAt] = useState(null);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    const identity = JSON.parse(sessionStorage.getItem('pr_identity') || '{}');
    if (!identity.name) { nav('/multijoueur'); return; }
    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      if (!joinedRef.current) {
        joinedRef.current = true;
        if (codeParam === 'nouveau') socket.emit('room:create', identity);
        else socket.emit('room:join', { code: codeParam, ...identity });
      }
    };
    const onDisconnect = () => setConnected(false);
    const onJoined = ({ code, playerId }) => { setPlayerId(playerId); if (codeParam === 'nouveau') window.history.replaceState({}, '', `/salon/${code}`); };
    const onUpdate = (r) => setRoom(r);
    const onTimer = ({ endsAt }) => setEndsAt(endsAt);
    const onError = ({ message }) => { setError(message); sound.play('error'); };
    const onKicked = () => { toast.error('Tu as été expulsé du salon.'); nav('/multijoueur'); };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:joined', onJoined);
    socket.on('room:update', onUpdate);
    socket.on('game:timer', onTimer);
    socket.on('room:error', onError);
    socket.on('room:kicked', onKicked);
    if (socket.connected) onConnect();

    return () => {
      socket.emit('room:leave');
      socket.off('connect', onConnect); socket.off('disconnect', onDisconnect);
      socket.off('room:joined', onJoined); socket.off('room:update', onUpdate);
      socket.off('game:timer', onTimer); socket.off('room:error', onError); socket.off('room:kicked', onKicked);
      joinedRef.current = false;
    };
  }, [codeParam]);

  if (error) {
    return (
      <div className="py-16 text-center max-w-sm mx-auto">
        <div className="text-5xl mb-4">🚪</div>
        <h1 className="text-xl font-bold mb-2">{error}</h1>
        <Button onClick={() => nav('/multijoueur')} className="mt-2">Retour</Button>
      </div>
    );
  }
  if (!room || !playerId) return <div className="py-24 text-center"><Spinner className="mx-auto" /><p className="text-muted text-sm mt-3">Connexion au salon…</p></div>;

  const me = room.players.find(p => p.id === playerId);
  const isHost = me?.isHost;
  const inLobby = room.phase === 'lobby';

  return (
    <div className={`py-6 sm:py-8 mx-auto w-full px-1 space-y-5 transition-[max-width] ${inLobby ? 'max-w-3xl' : 'max-w-5xl'}`}>
      {/* En-tête salon premium */}
      <div className="relative overflow-hidden rounded-3xl gradient-border p-5 md:p-6" style={{ background: 'linear-gradient(135deg, rgb(var(--brand)/0.14), rgb(var(--brand-2)/0.08))' }}>
        <div className="absolute -right-8 -top-10 opacity-10 pointer-events-none"><Gamepad2 className="h-44 w-44 text-brand" /></div>
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted mb-1 flex items-center gap-2">
              Salon privé · {connected ? <span className="text-success inline-flex items-center gap-1"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" /><span className="relative inline-flex rounded-full h-2 w-2 bg-success" /></span> connecté</span> : <span className="text-danger inline-flex items-center gap-1"><WifiOff className="h-3 w-3" /> reconnexion…</span>}
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(room.code); toast.success('Code copié !'); }} className="group inline-flex items-center gap-3">
              <span className="font-display font-bold text-4xl md:text-5xl tracking-[0.32em] gradient-text">{room.code}</span>
              <span className="rounded-lg bg-surface-2 p-2 text-muted group-hover:text-text transition-colors"><Copy className="h-4 w-4" /></span>
            </button>
            <div className="flex items-center gap-1.5 mt-2">
              {room.players.slice(0, 8).map(p => <div key={p.id} className="ring-2 ring-surface rounded-full"><Avatar name={p.avatar} label={p.name} size={26} /></div>)}
              <span className="text-xs text-muted ml-1">{room.players.filter(p => p.connected).length} en ligne</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { const url = `${location.origin}/salon/${room.code}`; navigator.clipboard?.writeText(url); toast.success('Lien copié !'); }}><Share2 className="h-4 w-4" /> Partager</Button>
            <Button variant="outline" size="sm" onClick={() => nav('/multijoueur')}><LogOut className="h-4 w-4" /> Quitter</Button>
          </div>
        </div>
      </div>

      {/* Joueurs */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold inline-flex items-center gap-2"><Users2 className="h-4 w-4 text-brand" /> Joueurs <span className="text-muted font-normal">({room.players.length}/12)</span></h2>
          {room.phase !== 'lobby' && (room.gameType === 'draw'
            ? (room.draw && <Tag color="warning">Tour {room.draw.turn}/{room.draw.totalTurns}</Tag>)
            : room.gameType === 'party'
            ? (room.party && <Tag color="warning">Manche {room.party.turn}/{room.party.total}</Tag>)
            : room.gameType === 'bluff'
            ? (room.bluff && <Tag color="warning">Manche {room.bluff.turn}/{room.bluff.total}</Tag>)
            : room.gameType === 'caption'
            ? (room.caption && <Tag color="warning">Manche {room.caption.turn}/{room.caption.total}</Tag>)
            : DUEL_TYPES.includes(room.gameType) || ['wyrduel', 'nbduel', 'wordduel', 'coupleduo', 'bacduel', 'twolies', 'assoc', 'nousquiz', 'rateduo', 'guessnote', 'askduo'].includes(room.gameType)
            ? null
            : <Tag color="warning">Manche {room.round}/{room.settings.rounds}</Tag>)}
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {room.players.map(p => (
            <div key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${p.connected ? 'bg-surface-2 border-transparent' : 'bg-surface-2/40 border-transparent opacity-60'} ${inLobby && p.ready ? 'border-success/40' : ''}`}>
              <div className="relative">
                <Avatar name={p.avatar} label={p.name} size={38} />
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${p.connected ? 'bg-success' : 'bg-muted/50'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate flex items-center gap-1">{p.name} {p.isHost && <Crown className="h-3.5 w-3.5 text-warning" />} {p.id === playerId && <span className="text-[10px] text-muted">(toi)</span>}</div>
                <div className={`text-xs ${inLobby && p.ready ? 'text-success' : 'text-muted'}`}>{!p.connected ? 'déconnecté' : inLobby ? (p.ready ? '✓ prêt' : 'en attente…') : 'en jeu'}</div>
              </div>
              {inLobby && isHost && p.id !== playerId && <button onClick={() => getSocket().emit('room:kick', { playerId: p.id })} title="Expulser" className="text-muted hover:text-danger p-1"><UserX className="h-4 w-4" /></button>}
            </div>
          ))}
        </div>
      </Card>

      {/* Contenu selon phase */}
      {inLobby ? (
        <>
          <LobbyControls room={room} me={me} isHost={isHost} />
          <InviteFriends />
          <Chat socket={getSocket()} room={room} playerId={playerId} compact />
        </>
      ) : (
        <GameStage room={room} playerId={playerId} endsAt={endsAt} />
      )}
    </div>
  );
}

// Table jeu -> composant (une seule source de vérité, plus de duplication)
const GAME_UI = {
  imposter: Imposter, draw: DrawGuess, party: Party, bluff: Bluff, caption: Caption,
  wyrduel: Wyr, nbduel: NumberDuel, wordduel: WordDuel, coupleduo: Couple,
  bacduel: Bac, twolies: TwoLies, assoc: Assoc, nousquiz: NousQuiz, rateduo: Rate, guessnote: GuessNote, askduo: Ask,
  morpion: Duel, connect4: Duel, rps: Duel, reflexduel: Duel, mathduel: Duel,
  quizduel: Duel, typerace: Duel, nim: Duel, memoduel: Duel, dots: Duel,
};

// Aire de jeu premium et responsive : jeu au centre, chat en colonne (grand écran)
// ou en tiroir accessible via un bouton (téléphone / tablette).
function GameStage({ room, playerId, endsAt }) {
  const [chatOpen, setChatOpen] = useState(false);
  const GameComp = GAME_UI[room.gameType];
  const stageGame = gameById(room.gameType);
  const socket = getSocket();
  const game = room.gameType && GAME_UI[room.gameType]
    ? <GameComp socket={socket} room={room} playerId={playerId} endsAt={endsAt} />
    : <div className="py-16 text-center text-muted"><Spinner className="mx-auto" /></div>;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
      <PartyMode socket={socket} room={room} playerId={playerId} />
      {/* Scène de jeu */}
      <div className="card-glow rounded-3xl overflow-hidden">
        {stageGame && (
          <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-border" style={{ background: `linear-gradient(90deg, ${stageGame.color[0]}1f, transparent)` }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white flex-none" style={{ background: `linear-gradient(135deg, ${stageGame.color[0]}, ${stageGame.color[1]})` }}>
              <stageGame.icon className="h-4 w-4" />
            </span>
            <span className="font-display font-bold text-sm">{stageGame.name}</span>
            <span className="ml-auto text-[11px] text-muted hidden sm:inline">{stageGame.players} joueurs · {stageGame.tagline}</span>
          </div>
        )}
        <div className="p-4 sm:p-6 min-h-[56vh] flex flex-col justify-center">
          {game}
        </div>
      </div>

      {/* Chat colonne (grand écran) */}
      <div className="hidden lg:block sticky top-20">
        <Chat socket={socket} room={room} playerId={playerId} />
      </div>

      {/* Bouton chat (mobile / tablette) */}
      <button onClick={() => setChatOpen(true)} className="lg:hidden fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-brand to-brand-2 text-white shadow-glow flex items-center justify-center active:scale-95 transition-transform" aria-label="Ouvrir le chat">
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Tiroir chat (mobile / tablette) */}
      {chatOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setChatOpen(false)} />
          <div className="relative z-10 animate-slideUp" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex justify-end px-3 pb-1">
              <button onClick={() => setChatOpen(false)} className="rounded-full bg-surface/80 backdrop-blur p-2 text-muted hover:text-text mb-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-2">
              <Chat socket={socket} room={room} playerId={playerId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LobbyControls({ room, me, isHost }) {
  const socket = getSocket();
  const s = room.settings;
  const maxImp = Math.max(1, Math.floor(room.players.length / 3));
  const isDraw = room.gameType === 'draw';
  const isParty = room.gameType === 'party';
  const isBluff = room.gameType === 'bluff';
  const isCaption = room.gameType === 'caption';
  const isDuel = DUEL_TYPES.includes(room.gameType) || ['wyrduel', 'nbduel', 'wordduel', 'coupleduo', 'bacduel', 'twolies', 'assoc', 'nousquiz', 'rateduo', 'guessnote', 'askduo'].includes(room.gameType);
  const isCouple = room.gameType === 'coupleduo';
  const canStart = isDuel ? room.players.length === 2 : room.players.length >= 3;

  return (
    <Card className="p-5 space-y-4">
      {/* Choix du jeu */}
      <div>
        <h3 className="font-semibold mb-2 text-sm text-muted">À plusieurs (3+)</h3>
        <div className="grid grid-cols-5 gap-2">
          {[{ id: 'imposter', emo: '🕵️', name: 'Imposteur' }, { id: 'draw', emo: '🎨', name: 'Draw' }, { id: 'party', emo: '🎉', name: 'Party' }, { id: 'bluff', emo: '🪶', name: 'Bluff' }, { id: 'caption', emo: '💬', name: 'Caption' }].map(g => (
            <button key={g.id} disabled={!isHost} onClick={() => socket.emit('room:setGame', { gameType: g.id })}
              className={`rounded-xl border p-2 text-center transition-all ${room.gameType === g.id ? 'border-brand bg-brand/10' : 'border-border bg-surface-2 hover:border-brand/40'} ${!isHost ? 'opacity-70 cursor-default' : ''}`}>
              <div className="text-lg">{g.emo}</div>
              <div className="font-semibold text-[11px] mt-0.5">{g.name}</div>
            </button>
          ))}
        </div>
        <h3 className="font-semibold mb-2 mt-3 text-sm text-muted">En duel (2 joueurs)</h3>
        <div className="grid grid-cols-5 gap-2">
          {[{ id: 'morpion', emo: '#️⃣', name: 'Morpion' }, { id: 'connect4', emo: '🔴', name: 'Puiss.4' }, { id: 'rps', emo: '✊', name: 'PFC' }, { id: 'reflexduel', emo: '⚡', name: 'Réflexe' }, { id: 'mathduel', emo: '➗', name: 'Calcul' }, { id: 'quizduel', emo: '❓', name: 'Quiz' }, { id: 'typerace', emo: '⌨️', name: 'Frappe' }, { id: 'nim', emo: '🥢', name: 'Bâtonnets' }, { id: 'memoduel', emo: '🃏', name: 'Mémoire' }, { id: 'dots', emo: '⬜', name: 'Carrés' }, { id: 'wyrduel', emo: '⚖️', name: 'Tu préfères' }, { id: 'nbduel', emo: '🔢', name: 'Nombre' }, { id: 'wordduel', emo: '🔤', name: 'Mot secret' }, { id: 'coupleduo', emo: '💞', name: 'Compatibilité' }, { id: 'bacduel', emo: '📝', name: 'Le Bac' }, { id: 'twolies', emo: '🤥', name: '2 vérités' }, { id: 'assoc', emo: '💭', name: 'Assoc' }, { id: 'nousquiz', emo: '💑', name: 'Nous' }, { id: 'rateduo', emo: '⭐', name: 'Note ça' }, { id: 'guessnote', emo: '🎯', name: 'Devine note' }, { id: 'askduo', emo: '🎤', name: 'Balance tout' }].map(g => (
            <button key={g.id} disabled={!isHost} onClick={() => socket.emit('room:setGame', { gameType: g.id })}
              className={`rounded-xl border p-2 text-center transition-all ${room.gameType === g.id ? 'border-brand bg-brand/10' : 'border-border bg-surface-2 hover:border-brand/40'} ${!isHost ? 'opacity-70 cursor-default' : ''}`}>
              <div className="text-lg">{g.emo}</div>
              <div className="font-semibold text-[11px] mt-0.5">{g.name}</div>
            </button>
          ))}
        </div>
        {!isHost && <p className="text-[11px] text-muted mt-2">Seul l'hôte peut choisir le jeu.</p>}
      </div>

      {isHost && !isDuel && (
        <div>
          <h3 className="font-semibold inline-flex items-center gap-2 mb-3 text-sm text-muted"><Settings className="h-4 w-4" /> Paramètres</h3>
          {isDraw ? (
            <div className="grid grid-cols-2 gap-3">
              <Setting label="Temps / dessin">
                <select value={s.drawSec} onChange={e => socket.emit('room:settings', { drawSec: +e.target.value })} className="w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm">
                  {[60, 75, 90, 120].map(n => <option key={n} value={n}>{n}s</option>)}
                </select>
              </Setting>
              <Setting label="Tours / joueur">
                <select value={s.drawRounds} onChange={e => socket.emit('room:settings', { drawRounds: +e.target.value })} className="w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm">
                  {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Setting>
            </div>
          ) : isParty ? (
            <div className="grid grid-cols-2 gap-3">
              <Setting label="Nombre de manches">
                <select value={s.partyRounds} onChange={e => socket.emit('room:settings', { partyRounds: +e.target.value })} className="w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm">
                  {[6, 8, 10, 12, 15].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Setting>
              <div className="flex items-end"><p className="text-xs text-muted">Tu préfères · Le plus susceptible · Hot Take s'enchaînent automatiquement.</p></div>
            </div>
          ) : isBluff ? (
            <Setting label="Nombre de manches">
              <select value={s.bluffRounds} onChange={e => socket.emit('room:settings', { bluffRounds: +e.target.value })} className="w-full max-w-[10rem] rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm">
                {[3, 4, 5, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Setting>
          ) : isCaption ? (
            <Setting label="Nombre de manches">
              <select value={s.captionRounds} onChange={e => socket.emit('room:settings', { captionRounds: +e.target.value })} className="w-full max-w-[10rem] rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm">
                {[3, 4, 5, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Setting>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Setting label="Thème">
                <select value={s.theme} onChange={e => socket.emit('room:settings', { theme: e.target.value })} className="w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm">
                  {(room.themes || ['Aléatoire']).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Setting>
              <Setting label="Imposteurs">
                <select value={s.imposters} onChange={e => socket.emit('room:settings', { imposters: +e.target.value })} className="w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm">
                  {Array.from({ length: maxImp }).map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </select>
              </Setting>
              <Setting label="Manches">
                <select value={s.rounds} onChange={e => socket.emit('room:settings', { rounds: +e.target.value })} className="w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm">
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Setting>
              <Setting label="Discussion">
                <select value={s.discussionSec} onChange={e => socket.emit('room:settings', { discussionSec: +e.target.value })} className="w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm">
                  {[60, 90, 120, 180].map(n => <option key={n} value={n}>{n}s</option>)}
                </select>
              </Setting>
            </div>
          )}
        </div>
      )}

      {isHost && isCouple && (
        <div>
          <h3 className="font-semibold mb-2 text-sm text-muted">Ambiance des questions</h3>
          <div className="grid grid-cols-3 gap-2">
            {[{ id: 'mignon', emo: '😊', name: 'Mignon' }, { id: 'flirt', emo: '😏', name: 'Flirt' }, { id: 'mix', emo: '💞', name: 'Mix' }].map(m => (
              <button key={m.id} onClick={() => socket.emit('room:settings', { coupleMode: m.id })}
                className={`rounded-xl border p-2.5 text-center transition-all ${(room.settings.coupleMode || 'mignon') === m.id ? 'border-brand bg-brand/10' : 'border-border bg-surface-2 hover:border-brand/40'}`}>
                <div className="text-lg">{m.emo}</div><div className="font-semibold text-xs mt-0.5">{m.name}</div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-1">« Flirt » = questions plus taquines (mais toujours correctes).</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant={me?.ready ? 'ghost' : 'primary'} className="flex-1" onClick={() => socket.emit('room:ready', { ready: !me?.ready })}>
          {me?.ready ? <><X className="h-4 w-4" /> Pas prêt</> : <><Check className="h-4 w-4" /> Je suis prêt</>}
        </Button>
        {isHost && (
          <Button className="flex-1" disabled={!canStart} onClick={() => socket.emit('game:start')}><Play className="h-4 w-4" /> Lancer</Button>
        )}
      </div>
      {isHost && !canStart && <p className="text-center text-xs text-muted">{isDuel ? 'Les duels se jouent exactement à 2 joueurs.' : 'Il faut au moins 3 joueurs pour lancer.'}</p>}
      {!isHost && <p className="text-center text-xs text-muted">En attente que l'hôte lance la partie…</p>}
    </Card>
  );
}

function Setting({ label, children }) {
  return <div><div className="text-xs text-muted mb-1">{label}</div>{children}</div>;
}

// Panneau d'invitation d'amis en ligne (dans le lobby).
function InviteFriends() {
  const { user } = useAuth();
  const friends = useFriends();
  const toast = useToast();
  const [invited, setInvited] = useState({});
  if (!user) return null;
  const online = (friends?.friends || []).filter(f => f.online);
  const invite = (f) => { friends.invitePlayer(f.id); setInvited(s => ({ ...s, [f.id]: true })); };
  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-3 inline-flex items-center gap-2 text-sm"><UserPlus2 className="h-4 w-4 text-brand" /> Inviter des amis</h3>
      {online.length === 0 ? (
        <p className="text-sm text-muted">Aucun ami en ligne pour le moment. <a href="/amis" className="text-brand hover:underline">Gérer mes amis</a></p>
      ) : (
        <div className="space-y-2">
          {online.map(f => (
            <div key={f.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
              <div className="relative"><Avatar name={f.avatar} label={f.username} size={30} /><span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" /></div>
              <span className="flex-1 text-sm font-medium truncate">{f.username}</span>
              <Button size="sm" variant={invited[f.id] ? 'ghost' : 'outline'} onClick={() => invite(f)}>{invited[f.id] ? 'Invité ✓' : 'Inviter'}</Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CodeDisplay({ code }) {
  const toast = useToast();
  return (
    <button onClick={() => { navigator.clipboard?.writeText(code); toast.success('Code copié !'); }} className="group inline-flex items-center gap-2">
      <span className="font-display font-bold text-3xl tracking-[0.3em]">{code}</span>
      <Copy className="h-4 w-4 text-muted group-hover:text-text" />
    </button>
  );
}
