// Présence en temps réel : qui est en ligne + activité ("dans un salon", "joue à …").
// Un utilisateur peut avoir plusieurs onglets (plusieurs sockets).
export class Presence {
  constructor(io, getFriendIds) {
    this.io = io;
    this.getFriendIds = getFriendIds;          // (userId) => [friendId]
    this.users = new Map();                     // userId -> { sockets:Set, activity }
    this.socketToUser = new Map();              // socketId -> userId
  }

  add(userId, socketId) {
    this.socketToUser.set(socketId, userId);
    let rec = this.users.get(userId);
    const wasOffline = !rec || rec.sockets.size === 0;
    if (!rec) { rec = { sockets: new Set(), activity: null }; this.users.set(userId, rec); }
    rec.sockets.add(socketId);
    if (wasOffline) this._notifyFriends(userId);
  }

  remove(socketId) {
    const userId = this.socketToUser.get(socketId);
    if (userId == null) return;
    this.socketToUser.delete(socketId);
    const rec = this.users.get(userId);
    if (!rec) return;
    rec.sockets.delete(socketId);
    if (rec.sockets.size === 0) { rec.activity = null; this._notifyFriends(userId); }
  }

  setActivity(userId, activity) {
    if (userId == null) return;
    const rec = this.users.get(userId);
    if (!rec) return;
    rec.activity = activity;
    this._notifyFriends(userId);
  }

  isOnline(userId) { const r = this.users.get(userId); return !!r && r.sockets.size > 0; }
  activityOf(userId) { const r = this.users.get(userId); return r ? r.activity : null; }
  statusOf(userId) { return { online: this.isOnline(userId), activity: this.activityOf(userId) || null }; }

  socketsOf(userId) { const r = this.users.get(userId); return r ? [...r.sockets] : []; }
  emitToUser(userId, event, payload) { for (const sid of this.socketsOf(userId)) this.io.to(sid).emit(event, payload); }

  _notifyFriends(userId) {
    let friendIds = [];
    try { friendIds = this.getFriendIds(userId) || []; } catch { friendIds = []; }
    const payload = { userId, ...this.statusOf(userId) };
    for (const fid of friendIds) if (this.isOnline(fid)) this.emitToUser(fid, 'friends:presence', payload);
  }
}
