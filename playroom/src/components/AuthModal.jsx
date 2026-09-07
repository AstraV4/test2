import React, { useState } from 'react';
import { Gamepad2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Modal, Button, Avatar } from './ui/index.jsx';
import { AVATARS } from '../lib/api.js';
import { sound } from '../lib/sound.js';

const ERR = {
  bad_username: "Le pseudo doit faire 3 à 18 caractères (lettres, chiffres, _).",
  weak_password: 'Le mot de passe doit faire au moins 6 caractères.',
  username_taken: 'Ce pseudo est déjà pris.',
  email_taken: 'Cet e-mail est déjà utilisé.',
  invalid_credentials: 'Pseudo ou mot de passe incorrect.',
  rate_limited: 'Trop de tentatives, réessaie dans un instant.',
};

export default function AuthModal() {
  const { authOpen, authMode, closeAuth, login, register } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState(authMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('nebula');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  React.useEffect(() => { setMode(authMode); setErr(''); }, [authMode, authOpen]);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'register') { await register({ username, password, avatar }); toast.success(`Bienvenue, ${username} !`); }
      else { const u = await login(username, password); toast.success(`Content de te revoir, ${u.username} !`); }
      sound.play('win'); closeAuth();
    } catch (ex) {
      setErr(ERR[ex.error] || 'Une erreur est survenue, réessaie.'); sound.play('error');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={authOpen} onClose={closeAuth} size="sm">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white"><Gamepad2 className="h-5 w-5" /></span>
        <span className="font-display font-bold text-lg">PLAY<span className="gradient-text">ROOM</span></span>
      </div>
      <h2 className="text-xl font-bold mb-1">{mode === 'register' ? 'Créer un compte' : 'Se connecter'}</h2>
      <p className="text-sm text-muted mb-5">{mode === 'register' ? 'Sauvegarde ta progression, ton XP et tes records.' : 'Ravi de te revoir sur PLAYROOM.'}</p>

      <form onSubmit={submit} className="space-y-3">
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Pseudo" autoComplete="username" required
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe (6 car. min.)" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand" />

        {mode === 'register' && (
          <div>
            <p className="text-xs font-semibold text-muted mb-2">Choisis ton avatar</p>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map(av => (
                <button type="button" key={av} onClick={() => { setAvatar(av); sound.play('click'); }}
                  className={`rounded-full transition-transform ${avatar === av ? 'ring-2 ring-brand scale-110' : 'opacity-70 hover:opacity-100'}`}>
                  <Avatar name={av} label={username || 'P'} size={34} />
                </button>
              ))}
            </div>
          </div>
        )}

        {err && <div className="flex items-start gap-2 rounded-xl bg-danger/10 border border-danger/20 px-3 py-2.5 text-xs text-danger"><AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-none" /><span>{err}</span></div>}

        <Button type="submit" loading={busy} className="w-full" size="lg">{mode === 'register' ? 'Créer mon compte' : 'Se connecter'}</Button>
      </form>

      <p className="mt-5 text-center text-xs text-muted">
        {mode === 'register' ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
        <button onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setErr(''); }} className="font-semibold text-brand hover:underline">
          {mode === 'register' ? 'Se connecter' : 'Créer un compte'}
        </button>
      </p>
    </Modal>
  );
}
