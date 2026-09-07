import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Gamepad2, Home, Grid3x3, Users2, Trophy, Search, Sun, Moon, Volume2, VolumeX, Menu, X, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { Avatar, Button } from '../ui/index.jsx';
import { sound } from '../../lib/sound.js';

const NAV = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/jeux', label: 'Jeux', icon: Grid3x3 },
  { to: '/multijoueur', label: 'Multijoueur', icon: Users2 },
  { to: '/classements', label: 'Classements', icon: Trophy },
];

export default function Header() {
  const { user, logout, openAuth } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(!sound.enabled);
  const nav = useNavigate();

  const toggleSound = () => { const en = sound.toggle(); setMuted(!en); if (en) sound.play('ok'); };
  const linkClass = ({ isActive }) => `px-3 py-2 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2 ${isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text hover:bg-surface-2/60'}`;

  return (
    <header className="sticky top-0 z-50 glass border-b border-border">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white shadow-glow"><Gamepad2 className="h-5 w-5" /></span>
            <span>PLAY<span className="gradient-text">ROOM</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(n => <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}><n.icon className="h-4 w-4" />{n.label}</NavLink>)}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => nav('/jeux')} title="Rechercher un jeu" className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors"><Search className="h-4 w-4" /></button>
          <button onClick={toggleSound} title="Son" className="h-9 w-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
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
            {NAV.map(n => <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={linkClass}><n.icon className="h-4 w-4" />{n.label}</NavLink>)}
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
