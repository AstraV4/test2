import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2, Heart } from 'lucide-react';
import { Button } from './ui/index.jsx';
import { avatarGradient } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

// Dessine une jolie carte souvenir sur un canvas → image PNG téléchargeable/partageable.
// props: title, statLine, subtitle, players:[{name,avatar}], accent (hex)
export default function ShareCard({ title = 'Belle partie !', statLine = '', subtitle = '', players = [], accent = '#ec4899', emoji = '💛' }) {
  const canvasRef = useRef(null);
  const [url, setUrl] = useState(null);
  const toast = useToast();

  useEffect(() => { draw(); /* eslint-disable-next-line */ }, [title, statLine, subtitle, JSON.stringify(players), accent]);

  const draw = () => {
    const cv = canvasRef.current; if (!cv) return;
    const W = 800, H = 480; cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    // fond dégradé
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#12151d'); g.addColorStop(1, mix(accent, '#12151d', 0.7));
    ctx.fillStyle = g; roundRect(ctx, 0, 0, W, H, 0); ctx.fill();
    // halo
    const rg = ctx.createRadialGradient(W / 2, 120, 20, W / 2, 120, 400);
    rg.addColorStop(0, hexA(accent, 0.35)); rg.addColorStop(1, hexA(accent, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    // logo
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '700 22px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PLAYROOM', W / 2, 56);
    // emoji + titre
    ctx.font = '64px serif'; ctx.fillText(emoji, W / 2, 150);
    ctx.fillStyle = '#fff'; ctx.font = '800 40px "Space Grotesk", Inter, sans-serif';
    wrapText(ctx, title, W / 2, 210, W - 100, 46);
    // stat principale
    ctx.fillStyle = accent; ctx.font = '800 56px "Space Grotesk", Inter, sans-serif';
    if (statLine) ctx.fillText(statLine, W / 2, 300);
    // sous-titre
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '400 22px Inter, sans-serif';
    if (subtitle) wrapText(ctx, subtitle, W / 2, statLine ? 344 : 300, W - 120, 30);
    // joueurs (avatars + noms)
    const py = 410;
    if (players.length) {
      const gap = 220; const startX = W / 2 - (players.length - 1) * gap / 2;
      players.forEach((p, i) => {
        const x = startX + i * gap;
        drawAvatar(ctx, x, py, 34, p.avatar || 'nebula', p.name || '?');
        ctx.fillStyle = '#fff'; ctx.font = '600 18px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText((p.name || '').slice(0, 14), x, py + 62);
      });
      if (players.length === 2) { ctx.fillStyle = accent; ctx.font = '28px serif'; ctx.fillText('✕', W / 2, py + 6); }
    }
    // date
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '400 14px Inter, sans-serif';
    ctx.fillText(new Date().toLocaleDateString('fr-FR'), W / 2, H - 16);
    setUrl(cv.toDataURL('image/png'));
  };

  const download = () => { if (!url) return; const a = document.createElement('a'); a.href = url; a.download = 'playroom-souvenir.png'; a.click(); toast.success('Carte téléchargée !'); };
  const share = async () => {
    try {
      if (navigator.canShare && url) {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], 'playroom.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: `${title} ${statLine}` }); return; }
      }
      if (navigator.share) { await navigator.share({ text: `${title} ${statLine} — sur PLAYROOM` }); return; }
      download();
    } catch { /* annulé */ }
  };

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="w-full rounded-2xl border border-border shadow-card" style={{ aspectRatio: '800/480' }} />
      <div className="flex gap-2 justify-center">
        <Button onClick={share}><Share2 className="h-4 w-4" /> Partager</Button>
        <Button variant="outline" onClick={download}><Download className="h-4 w-4" /> Télécharger</Button>
      </div>
    </div>
  );
}

/* utils canvas */
function drawAvatar(ctx, cx, cy, r, name, label) {
  const [a, b] = avatarGradient(name);
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `700 ${r}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((label || '?').slice(0, 1).toUpperCase(), cx, cy + 1); ctx.textBaseline = 'alphabetic';
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wrapText(ctx, text, x, y, maxW, lh) { const words = String(text).split(' '); let line = ''; let yy = y; for (const w of words) { const t = line + w + ' '; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line.trim(), x, yy); line = w + ' '; yy += lh; } else line = t; } ctx.fillText(line.trim(), x, yy); }
function hexA(hex, a) { const { r, g, b } = h2rgb(hex); return `rgba(${r},${g},${b},${a})`; }
function mix(h1, h2, t) { const a = h2rgb(h1), b = h2rgb(h2); const r = Math.round(a.r * (1 - t) + b.r * t), g = Math.round(a.g * (1 - t) + b.g * t), bl = Math.round(a.b * (1 - t) + b.b * t); return `rgb(${r},${g},${bl})`; }
function h2rgb(hex) { const m = hex.replace('#', ''); return { r: parseInt(m.slice(0, 2), 16), g: parseInt(m.slice(2, 4), 16), b: parseInt(m.slice(4, 6), 16) }; }
