import React, { createContext, useContext, useCallback, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
const COLORS = { success: 'text-success', error: 'text-danger', warning: 'text-warning', info: 'text-brand-2' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);
  const push = useCallback((message, type = 'info', ttl = 3800) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, type }]);
    if (ttl) setTimeout(() => remove(id), ttl);
    return id;
  }, [remove]);
  const toast = {
    show: push,
    success: (m, ttl) => push(m, 'success', ttl),
    error: (m, ttl) => push(m, 'error', ttl),
    info: (m, ttl) => push(m, 'info', ttl),
    warning: (m, ttl) => push(m, 'warning', ttl),
  };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 w-[min(92vw,360px)]">
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} role="status" className="card rounded-2xl shadow-card px-4 py-3 flex items-start gap-3 animate-slideUp">
              <Icon className={`h-5 w-5 mt-0.5 flex-none ${COLORS[t.type] || ''}`} />
              <p className="text-sm text-text flex-1 leading-snug">{t.message}</p>
              <button onClick={() => remove(t.id)} className="text-muted hover:text-text transition-colors"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
