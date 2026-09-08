import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import Background from './components/layout/Background.jsx';
import AuthModal from './components/AuthModal.jsx';
import { Button } from './components/ui/index.jsx';

import Home from './pages/Home.jsx';
import Games from './pages/Games.jsx';
import GameDetail from './pages/GameDetail.jsx';
import Profile from './pages/Profile.jsx';
import Leaderboards from './pages/Leaderboards.jsx';
import Multiplayer from './pages/Multiplayer.jsx';
import Room from './pages/Room.jsx';
import Daily from './pages/Daily.jsx';
import Friends from './pages/Friends.jsx';
import Messages from './pages/Messages.jsx';
import PublicProfile from './pages/PublicProfile.jsx';
import { FriendsProvider } from './context/FriendsContext.jsx';
import { GameFavsProvider } from './context/GameFavsContext.jsx';

export default function App() {
  const loc = useLocation();
  // Le salon prend tout l'écran (pas de footer encombrant)
  return (
    <FriendsProvider>
    <GameFavsProvider>
    <div className="app-bg min-h-screen flex flex-col">
      <Background />
      <Header />
      <main key={loc.pathname} className="flex-1 mx-auto w-full max-w-6xl px-4 page-enter">
        <Routes location={loc}>
          <Route path="/" element={<Home />} />
          <Route path="/jeux" element={<Games />} />
          <Route path="/jeux/:slug" element={<GameDetail />} />
          <Route path="/defi" element={<Daily />} />
          <Route path="/amis" element={<Friends />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:userId" element={<Messages />} />
          <Route path="/u/:id" element={<PublicProfile />} />
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
    </GameFavsProvider>
    </FriendsProvider>
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
