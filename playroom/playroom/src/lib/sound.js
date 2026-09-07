// Effets sonores légers générés par WebAudio (aucun fichier externe).
// Activables/désactivables globalement ; l'état est persistant en mémoire de session.
let enabled = true;
let ctx = null;
function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } return ctx; }

export const sound = {
  get enabled() { return enabled; },
  set(v) { enabled = !!v; },
  toggle() { enabled = !enabled; return enabled; },
  play(type = 'click') {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const now = a.currentTime;
    const presets = {
      click: [[520, 0.05, 'square', 0.04]],
      ok: [[660, 0.08, 'sine', 0.06], [880, 0.1, 'sine', 0.05]],
      error: [[200, 0.16, 'sawtooth', 0.05]],
      win: [[523, 0.1, 'sine', 0.07], [659, 0.1, 'sine', 0.07], [784, 0.18, 'sine', 0.07]],
      lose: [[330, 0.14, 'triangle', 0.06], [247, 0.22, 'triangle', 0.06]],
      tick: [[880, 0.03, 'square', 0.03]],
      notify: [[740, 0.08, 'sine', 0.05], [988, 0.1, 'sine', 0.05]],
    };
    const seq = presets[type] || presets.click;
    let t = now;
    for (const [freq, dur, wave, gain] of seq) {
      const osc = a.createOscillator(); const g = a.createGain();
      osc.type = wave; osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(a.destination); osc.start(t); osc.stop(t + dur + 0.02);
      t += dur * 0.7;
    }
  },
};
