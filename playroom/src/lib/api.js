// Wrapper fetch : credentials inclus (cookie httpOnly), JSON, erreurs typées.
export async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  let data = null;
  try { data = await res.json(); } catch { /* pas de corps */ }
  if (!res.ok) { const err = new Error((data && data.error) || `http_${res.status}`); err.error = data?.error; err.status = res.status; throw err; }
  return data;
}

export const AVATARS = ['nebula', 'comet', 'aurora', 'pulsar', 'quasar', 'orbit', 'flare', 'zenith'];
export function avatarGradient(name) {
  const map = {
    nebula: ['#7c5cff', '#588cff'], comet: ['#22d3ee', '#3b82f6'], aurora: ['#34d399', '#22d3be'],
    pulsar: ['#f472b6', '#a855f7'], quasar: ['#fb923c', '#f43f5e'], orbit: ['#facc15', '#f97316'],
    flare: ['#f43f5e', '#7c5cff'], zenith: ['#38bdf8', '#818cf8'],
  };
  return map[name] || map.nebula;
}
