import jwt from 'jsonwebtoken';

export const COOKIE = 'pr_token';
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const secure = (process.env.APP_URL || '').startsWith('https');

export function signToken(userId) {
  return jwt.sign({ uid: userId }, SECRET, { expiresIn: '30d' });
}
export function verifyToken(token) {
  try { return jwt.verify(token, SECRET).uid; } catch { return null; }
}
export function setAuthCookie(res, userId) {
  res.cookie(COOKIE, signToken(userId), {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}
export function clearAuthCookie(res) { res.clearCookie(COOKIE, { path: '/' }); }

export function userIdFromReq(req) {
  const t = req.cookies?.[COOKIE];
  return t ? verifyToken(t) : null;
}
export function requireAuth(req, res, next) {
  const uid = userIdFromReq(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  req.userId = uid;
  next();
}
