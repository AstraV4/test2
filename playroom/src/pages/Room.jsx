import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Crown, LogOut, Play, Check, X, Settings, UserX, Share2, Wifi, WifiOff } from 'lucide-react';
import { getSocket } from '../lib/socket.js';
import { Card, Button, Avatar, Tag, Spinner } from '../components/ui/index.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Imposter from '../games/imposter/Imposter.jsx';
import DrawGuess from '../games/draw/DrawGuess.jsx';
import Chat from '../components/Chat.jsx';
import { sound } from '../lib/sound.js';

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
    <div className="py-8 max-w-2xl mx-auto space-y-5">
      {/* En-tête salon */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-muted mb-1 flex items-center gap-2">
              Salon {connected ? <span className="text-success inline-flex items-center gap-1"><Wifi className="h-3 w-3" /> en ligne</span> : <span className="text-danger inline-flex items-center gap-1"><WifiOff className="h-3 w-3" /> reconnexion…</span>}
            </div>
            <CodeDisplay code={room.code} />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { const url = `${location.origin}/salon/${room.code}`; navigator.clipboard?.writeText(url); toast.success('Lien copié !'); }}><Share2 className="h-4 w-4" /> Partager</Button>
            <Button variant="outline" size="sm" onClick={() => nav('/multijoueur')}><LogOut className="h-4 w-4" /> Quitter</Button>
          </div>
        </div>
      </Card>

      {/* Joueurs */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Joueurs <span className="text-muted">({room.players.length}/12)</span></h2>
          {room.phase !== 'lobby' && (room.gameType === 'draw'
            ? (room.draw && <Tag color="warning">Tour {room.draw.turn}/{room.draw.totalTurns}</Tag>)
            : <Tag color="warning">Manche {room.round}/{room.settings.rounds}</Tag>)}
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {room.players.map(p => (
            <div key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${p.connected ? 'bg-surface-2' : 'bg-surface-2/50 opacity-60'}`}>
              <Avatar name={p.avatar} label={p.name} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate flex items-center gap-1">{p.name} {p.isHost && <Crown className="h-3.5 w-3.5 text-warning" />}</div>
                <div className="text-xs text-muted">{!p.connected ? 'déconnecté' : inLobby ? (p.ready ? 'prêt' : 'en attente') : 'en jeu'}</div>
              </div>
              {inLobby && p.ready && <Check className="h-4 w-4 text-success" />}
              {inLobby && isHost && p.id !== playerId && <button onClick={() => getSocket().emit('room:kick', { playerId: p.id })} title="Expulser" className="text-muted hover:text-danger"><UserX className="h-4 w-4" /></button>}
            </div>
          ))}
        </div>
      </Card>

      {/* Contenu selon phase */}
      {inLobby ? (
        <>
          <LobbyControls room={room} me={me} isHost={isHost} />
          <Chat socket={getSocket()} room={room} playerId={playerId} compact />
        </>
      ) : room.gameType === 'draw' ? (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-4 lg:col-span-2">
            <DrawGuess socket={getSocket()} room={room} playerId={playerId} endsAt={endsAt} />
          </Card>
          <Chat socket={getSocket()} room={room} playerId={playerId} />
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2">
            <Imposter socket={getSocket()} room={room} playerId={playerId} endsAt={endsAt} />
          </Card>
          <Chat socket={getSocket()} room={room} playerId={playerId} />
        </div>
      )}
    </div>
  );
}

function LobbyControls({ room, me, isHost }) {
  const socket = getSocket();
  const s = room.settings;
  const canStart = room.players.length >= 3;
  const maxImp = Math.max(1, Math.floor(room.players.length / 3));
  const isDraw = room.gameType === 'draw';

  return (
    <Card className="p-5 space-y-4">
      {/* Choix du jeu */}
      <div>
        <h3 className="font-semibold mb-2 text-sm text-muted">Jeu</h3>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: 'imposter', emo: '🕵️', name: 'Imposteur', sub: 'Déduction' }, { id: 'draw', emo: '🎨', name: 'Draw & Guess', sub: 'Dessin' }].map(g => (
            <button key={g.id} disabled={!isHost} onClick={() => socket.emit('room:setGame', { gameType: g.id })}
              className={`rounded-xl border p-3 text-left transition-all ${room.gameType === g.id ? 'border-brand bg-brand/10' : 'border-border bg-surface-2 hover:border-brand/40'} ${!isHost ? 'opacity-70 cursor-default' : ''}`}>
              <div className="text-xl">{g.emo}</div>
              <div className="font-semibold text-sm mt-1">{g.name}</div>
              <div className="text-xs text-muted">{g.sub}</div>
            </button>
          ))}
        </div>
        {!isHost && <p className="text-[11px] text-muted mt-1">Seul l'hôte peut choisir le jeu.</p>}
      </div>

      {isHost && (
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
          ) : (
            <div className="grid grid-cols-3 gap-3">
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

      <div className="flex gap-2">
        <Button variant={me?.ready ? 'ghost' : 'primary'} className="flex-1" onClick={() => socket.emit('room:ready', { ready: !me?.ready })}>
          {me?.ready ? <><X className="h-4 w-4" /> Pas prêt</> : <><Check className="h-4 w-4" /> Je suis prêt</>}
        </Button>
        {isHost && (
          <Button className="flex-1" disabled={!canStart} onClick={() => socket.emit('game:start')}><Play className="h-4 w-4" /> Lancer</Button>
        )}
      </div>
      {isHost && !canStart && <p className="text-center text-xs text-muted">Il faut au moins 3 joueurs pour lancer.</p>}
      {!isHost && <p className="text-center text-xs text-muted">En attente que l'hôte lance la partie…</p>}
    </Card>
  );
}

function Setting({ label, children }) {
  return <div><div className="text-xs text-muted mb-1">{label}</div>{children}</div>;
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
