import { io } from 'socket.io-client';

// Singleton Socket.IO : réutilisé par le lobby et les jeux multijoueur.
// La reconnexion automatique est gérée par Socket.IO (option par défaut).
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io('/', {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 4000,
      withCredentials: true,
    });
  }
  return socket;
}

export function closeSocket() {
  if (socket) { socket.close(); socket = null; }
}
