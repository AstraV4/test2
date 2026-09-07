import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import AuthModal from './components/AuthModal.jsx';
import { Button } from './components/ui/index.jsx';

import Home from './pages/Home.jsx';
import Games from './pages/Games.jsx';
import GameDetail from './pages/GameDetail.jsx';
import Profile from './pages/Profile.jsx';
import Leaderboards from './pages/Leaderboards.jsx';
import Multiplayer from './pages/Multiplayer.jsx';
import Room from './pages/Room.jsx';

export default function App() {
  const loc = useLocation();
  // Le salon prend tout l'écran (pas de footer encombrant)
  return (
    <div className="app-bg min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jeux" element={<Games />} />
          <Route path="/jeux/:slug" element={<GameDetail />} />
          <Route path="/multijoueur" element={<Multiplayer />} />
          <Route path="/salon/:code" element={<Room />} />
          <Route path="/classements" element={<Leaderboards />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!loc.pathname.startsWith('/salon/') && <Footer />}
      <AuthModal />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted">
        <span>PLAY<span className="gradient-text font-semibold">ROOM</span> — Joue. Défie. Recommence.</span>
        <div className="flex gap-4">
          <Link to="/jeux" className="hover:text-text">Jeux</Link>
          <Link to="/multijoueur" className="hover:text-text">Multijoueur</Link>
          <Link to="/classements" className="hover:text-text">Classements</Link>
        </div>
      </div>
    </footer>
  );
}

function NotFound() {
  return (
    <div className="py-24 text-center">
      <div className="text-6xl mb-4">🎲</div>
      <h1 className="font-display font-bold text-2xl mb-2">Page introuvable</h1>
      <p className="text-muted mb-6">Cette page n'existe pas (ou plus).</p>
      <Button as={Link} to="/">Retour à l'accueil</Button>
    </div>
  );
}
