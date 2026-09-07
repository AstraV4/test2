import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users2, Plus, LogIn, Ghost } from 'lucide-react';
import { Card, Button, Avatar } from '../components/ui/index.jsx';
import { AVATARS } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { sound } from '../lib/sound.js';

// Le pseudo/avatar de session multijoueur (indépendant du compte, pour jouer vite).
export function usePlayerIdentity() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || 'nebula');
  return { name, setName, avatar, setAvatar };
}

export default function Multiplayer() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || 'nebula');
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('create');

  const go = (action) => {
    const pseudo = (name || user?.username || '').trim();
    if (!pseudo) { sound.play('error'); return; }
    // On stocke l'identité pour la salle
    sessionStorage.setItem('pr_identity', JSON.stringify({ name: pseudo, avatar }));
    if (action === 'create') nav('/salon/nouveau');
    else { if (!code.trim()) { sound.play('error'); return; } nav(`/salon/${code.trim().toUpperCase()}`); }
  };

  return (
    <div className="py-8 max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white mb-3"><Users2 className="h-7 w-7" /></div>
        <h1 className="font-display font-bold text-3xl">Jouer entre amis</h1>
        <p className="text-muted mt-1">Crée un salon ou rejoins-en un avec un code. Choisis ensuite <b className="text-text">Imposteur</b> ou <b className="text-text">Draw & Guess</b> dans le salon.</p>
      </div>

      <Card className="p-6 space-y-5">
        {/* Identité */}
        <div>
          <label className="text-xs font-semibold text-muted">Ton pseudo</label>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={18} placeholder="Ex : Alex" className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />
          <div className="flex flex-wrap gap-2 mt-3">
            {AVATARS.map(av => (
              <button key={av} onClick={() => { setAvatar(av); sound.play('click'); }} className={`rounded-full transition-transform ${avatar === av ? 'ring-2 ring-brand scale-110' : 'opacity-70 hover:opacity-100'}`}>
                <Avatar name={av} label={name || 'P'} size={34} />
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Onglets */}
        <div className="flex gap-2">
          <button onClick={() => setTab('create')} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${tab === 'create' ? 'bg-brand text-white' : 'bg-surface-2 text-muted'}`}><Plus className="h-4 w-4 inline mr-1" /> Créer</button>
          <button onClick={() => setTab('join')} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${tab === 'join' ? 'bg-brand text-white' : 'bg-surface-2 text-muted'}`}><LogIn className="h-4 w-4 inline mr-1" /> Rejoindre</button>
        </div>

        {tab === 'create' ? (
          <Button size="lg" className="w-full" onClick={() => go('create')}><Plus className="h-4 w-4" /> Créer un salon</Button>
        ) : (
          <div className="flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={5} placeholder="CODE" className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-mono tracking-widest text-center outline-none focus:border-brand" />
            <Button size="lg" onClick={() => go('join')}>Rejoindre</Button>
          </div>
        )}
      </Card>

      <Card className="p-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/15 text-danger flex-none"><Ghost className="h-5 w-5" /></div>
        <div>
          <h3 className="font-semibold text-sm">Comment jouer à l'Imposteur</h3>
          <p className="text-sm text-muted mt-1">3 à 12 joueurs. Chacun reçoit le même mot secret, sauf l'imposteur. Donnez un indice chacun votre tour, discutez, puis votez pour démasquer l'intrus.</p>
        </div>
      </Card>
    </div>
  );
}
