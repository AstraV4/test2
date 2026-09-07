import React from 'react';
import { Loader2 } from 'lucide-react';
import { avatarGradient } from '../../lib/api.js';
import { sound } from '../../lib/sound.js';

/* ---------------- Button ---------------- */
export function Button({ as: Tag = 'button', variant = 'primary', size = 'md', className = '', children, loading, disabled, onClick, ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none';
  const sizes = { sm: 'text-xs px-3 py-2', md: 'text-sm px-4 py-2.5', lg: 'text-base px-6 py-3.5' };
  const variants = {
    primary: 'text-white shadow-glow bg-gradient-to-br from-brand to-brand-2 hover:brightness-110',
    accent: 'text-white bg-accent hover:brightness-110',
    ghost: 'text-text bg-surface-2 hover:bg-border',
    outline: 'text-text border border-border hover:bg-surface-2',
    danger: 'text-white bg-danger hover:brightness-110',
    subtle: 'text-muted hover:text-text',
  };
  const handle = (e) => { sound.play('click'); onClick?.(e); };
  return (
    <Tag className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || loading} onClick={handle} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Tag>
  );
}

/* ---------------- Card ---------------- */
export function Card({ className = '', hover = false, children, ...rest }) {
  return (
    <div className={`card rounded-2xl ${hover ? 'transition-all hover:-translate-y-0.5 hover:shadow-card hover:border-brand/40' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ name = 'nebula', label = '', size = 40, ring = false }) {
  const [a, b] = avatarGradient(name);
  const initial = (label || '?').slice(0, 1).toUpperCase();
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold text-white flex-none ${ring ? 'ring-2 ring-brand/50' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, ${a}, ${b})` }} aria-hidden={!label}>
      {initial}
    </span>
  );
}

/* ---------------- Badge / Tag ---------------- */
export function Tag({ children, color = 'brand', className = '' }) {
  const map = {
    brand: 'bg-brand/15 text-brand', accent: 'bg-accent/15 text-accent',
    success: 'bg-success/15 text-success', warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger', muted: 'bg-surface-2 text-muted',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[color]} ${className}`}>{children}</span>;
}

/* ---------------- Spinner / Loading ---------------- */
export function Spinner({ className = '' }) { return <Loader2 className={`h-5 w-5 animate-spin text-muted ${className}`} />; }
export function LoadingBlock({ label = 'Chargement…' }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-muted text-sm"><Spinner /> {label}</div>;
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="text-center py-16 px-4">
      {Icon && <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted"><Icon className="h-6 w-6" /></div>}
      <h3 className="font-semibold text-text">{title}</h3>
      {hint && <p className="text-sm text-muted mt-1 max-w-xs mx-auto">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- Progress ---------------- */
export function Progress({ value = 0, className = '' }) {
  return (
    <div className={`h-2 rounded-full bg-surface-2 overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, children, className = '', size = 'md' }) {
  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-popIn" onClick={onClose} />
      <div className={`relative z-10 w-full ${sizes[size]} card rounded-3xl shadow-card p-6 animate-slideUp ${className}`}>
        {children}
      </div>
    </div>
  );
}
