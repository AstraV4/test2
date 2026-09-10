import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Gamepad2, Home, Grid3x3, Users2, Trophy, Search, Sun, Moon, Volume2, VolumeX, Menu, X, LogOut, User as UserIcon, Flame, UserPlus, MessageCircle, Music, Music2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useFriends } from '../../context/FriendsContext.jsx';
import { Avatar, Button } from '../ui/index.jsx';
import { sound } from '../../lib/sound.js';
import { toggleMusic, isMusicPlaying, music } from '../../lib/music.js';

const NAV = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/jeux', label: 'Jeux', icon: Grid3x3 },
  { to: '/defi', label: 'Défi', icon: Flame },
  { to: '/multijoueur', label: 'Multi', icon: Users2 },
  { to: '/amis', label: 'Amis', icon: UserPlus },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/classements', label: 'Classements', icon: Trophy },
];

export default function Header() {
  const { user, logout, openAuth } = useAuth();
  const { theme, toggle } = useTheme();
  const friends = useFriends();
  const incoming = friends?.incoming?.length || 0;
  const unread = friends?.unread?.total || 0;
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(!sound.enabled);
  const [musicOn, setMusicOn] = useState(false);
  const nav = useNavigate();

  const toggleSound = () => { const en = sound.toggle(); setMuted(!en); if (en) sound.play('ok'); };
  const onToggleMusic = () => { const on = toggleMusic(); setMusicOn(on); };
  const linkClass = ({ isActive }) => `px-3 py-2 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2 relative ${isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text hover:bg-surface-2/60'}`;
  const badge = (to) => {
    const n = to === '/amis' ? incoming : to === '/messages' ? unread : 0;
    return n > 0 ? <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">{n}</span> : null;
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-border">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white shadow-glow"><Gamepad2 className="h-5 w-5" /></span>
            <span>PLAY<span className="gradient-text">ROOM</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(n => <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}><n.icon className="h-4 w-4" />{n.label}{badge(n.to)}</NavLink>)}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => nav('/jeux')} title="Rechercher un jeu" className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors"><Search className="h-4 w-4" /></button>
          <button onClick={toggleSound} title="Effets sonores" className="h-9 w-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
          <button onClick={onToggleMusic} title="Musique d'ambiance" className={`h-9 w-9 flex items-center justify-center rounded-xl transition-colors ${musicOn ? 'text-brand bg-brand/10' : 'text-muted hover:text-text hover:bg-surface-2'}`}>{musicOn ? <Music2 className="h-4 w-4" /> : <Music className="h-4 w-4" />}</button>
          <button onClick={toggle} title="Thème" className="h-9 w-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors">{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>

          {user ? (
            <Link to="/profil" className="ml-1 hidden md:flex items-center gap-2 rounded-xl bg-surface-2 pl-1 pr-3 py-1 hover:bg-border transition-colors">
              <Avatar name={user.avatar} label={user.username} size={30} />
              <span className="text-sm font-semibold max-w-[8rem] truncate">{user.username}</span>
              <span className="text-[10px] font-bold text-brand">Nv.{user.level}</span>
            </Link>
          ) : (
            <Button size="sm" className="ml-1 hidden md:inline-flex" onClick={() => openAuth('login')}>Connexion</Button>
          )}

          <button onClick={() => setOpen(o => !o)} className="md:hidden h-9 w-9 flex items-center justify-center rounded-xl text-text hover:bg-surface-2">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="md:hidden border-t border-border bg-surface animate-slideUp">
          <nav className="px-4 py-3 flex flex-col gap-1">
            {NAV.map(n => <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={linkClass}><n.icon className="h-4 w-4" />{n.label}{badge(n.to)}</NavLink>)}
            <div className="h-px bg-border my-2" />
            {user ? (
              <>
                <NavLink to="/profil" onClick={() => setOpen(false)} className={linkClass}><UserIcon className="h-4 w-4" /> Mon profil (Nv.{user.level})</NavLink>
                <button onClick={() => { logout(); setOpen(false); }} className="px-3 py-2 rounded-xl text-sm font-medium text-danger hover:bg-surface-2 inline-flex items-center gap-2"><LogOut className="h-4 w-4" /> Déconnexion</button>
              </>
            ) : (
              <Button onClick={() => { openAuth('login'); setOpen(false); }}>Connexion / Inscription</Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
