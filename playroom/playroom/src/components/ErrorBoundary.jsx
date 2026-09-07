import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('UI error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen app-bg flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">🎮</div>
            <h1 className="text-xl font-bold mb-2">Oups, un souci est survenu.</h1>
            <p className="text-muted text-sm mb-6">Recharge la page pour continuer.</p>
            <button onClick={() => window.location.reload()} className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:opacity-90">Recharger</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
