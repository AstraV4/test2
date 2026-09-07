import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { sound } from './sound.js';

const ACH_LABELS = {
  first_game: '🎮 Première partie', first_win: '🏆 Première victoire',
  ten_games: '🎯 10 parties', addict: '🔥 Accro (25 parties)', century: '💯 100 parties',
  ten_wins: '🥇 10 victoires',
  fast_reflex: '⚡ Réflexe éclair', memory_master: '🧠 Maître de la mémoire',
  quiz_genius: '💡 Génie du quiz', word_hunter: '🕵️ Chasseur de mots',
  math_wizard: '🔢 Sorcier du calcul', speed_typist: '⌨️ Doigts de fée', grid_master: '🟪 Maître de la grille',
};

// Soumet un score au serveur et gère XP / record / succès / niveau.
export function useSubmitScore() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  return useCallback(async (game, score, opts = {}) => {
    if (!user) { return null; } // invité : pas de sauvegarde (l'appelant peut proposer de se connecter)
    try {
      const prevLevel = user.level;
      const d = await api('/api/games/score', { method: 'POST', body: { game, score, won: !!opts.won, meta: opts.meta || null } });
      if (d.user) {
        setUser(d.user);
        if (d.user.level > prevLevel) { sound.play('win'); toast.success(`Niveau ${d.user.level} atteint ! 🎉`); }
      }
      if (d.isRecord && opts.announceRecord !== false) toast.success('Nouveau record personnel ! ⭐');
      (d.newAchievements || []).forEach(code => toast.info(`Succès débloqué : ${ACH_LABELS[code] || code}`, 5000));
      return d;
    } catch { return null; }
  }, [user, setUser, toast]);
}

export { ACH_LABELS };

// Compte à rebours synchronisé sur un timestamp de fin (serveur).
export function useCountdown(endsAt) {
  const [left, setLeft] = useState(() => remain(endsAt));
  useEffect(() => {
    setLeft(remain(endsAt));
    if (!endsAt) return;
    const t = setInterval(() => setLeft(remain(endsAt)), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  return left; // secondes restantes (0 si écoulé)
}
function remain(endsAt) { return endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0; }

// Valeur qui persiste entre rendus sans recréer.
export function useLatest(value) { const ref = useRef(value); ref.current = value; return ref; }
