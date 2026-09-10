// Musique d'ambiance générée en WebAudio (aucun fichier externe).
// Une boucle d'accords douce (pads) + une petite mélodie discrète, volume faible.
// Activable/désactivable ; l'état persiste dans localStorage.
let ctx = null;
let master = null;
let playing = false;
let timer = null;
let step = 0;

const KEY = 'pr_music_on';
export const music = {
  get enabled() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } },
  _setEnabled(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* ignore */ } },
};

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);
    } catch { ctx = null; }
  }
  return ctx;
}

// Gamme douce (La mineur pentatonique) — agréable, jamais dissonante.
const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0]; // A3 C4 D4 E4 G4 A4
// Accords (fréquences de base) qui tournent lentement
const CHORDS = [
  [146.83, 220.0, 261.63], // Dm-ish
  [130.81, 196.0, 246.94], // C
  [110.0, 164.81, 220.0],  // Am
  [174.61, 220.0, 261.63], // F
];

function pad(freq, when, dur) {
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.16, when + 0.8);      // fondu d'entrée
  g.gain.linearRampToValueAtTime(0.0, when + dur);        // fondu de sortie
  osc.connect(g); g.connect(master);
  osc.start(when); osc.stop(when + dur + 0.1);
}

function pluck(freq, when) {
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.10, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 1.2);
  osc.connect(g); g.connect(master);
  osc.start(when); osc.stop(when + 1.3);
}

function schedule() {
  const a = ac(); if (!a || !playing) return;
  const now = a.currentTime + 0.05;
  const chord = CHORDS[step % CHORDS.length];
  // nappe d'accord (2 mesures)
  chord.forEach(f => pad(f, now, 4.0));
  // quelques notes de mélodie douces, aléatoires mais dans la gamme
  for (let i = 0; i < 3; i++) {
    if (Math.random() < 0.7) {
      const f = SCALE[Math.floor(Math.random() * SCALE.length)];
      pluck(f, now + 0.5 + i * 1.1);
    }
  }
  step++;
}

export function startMusic() {
  const a = ac(); if (!a) return false;
  if (a.state === 'suspended') a.resume();
  if (playing) return true;
  playing = true;
  music._setEnabled(true);
  master.gain.cancelScheduledValues(a.currentTime);
  master.gain.setValueAtTime(master.gain.value, a.currentTime);
  master.gain.linearRampToValueAtTime(0.5, a.currentTime + 1.5); // volume doux
  schedule();
  timer = setInterval(schedule, 4000); // une boucle toutes les 4 s
  return true;
}

export function stopMusic() {
  playing = false;
  music._setEnabled(false);
  if (timer) { clearInterval(timer); timer = null; }
  const a = ctx;
  if (a && master) {
    master.gain.cancelScheduledValues(a.currentTime);
    master.gain.setValueAtTime(master.gain.value, a.currentTime);
    master.gain.linearRampToValueAtTime(0.0, a.currentTime + 0.8); // fondu de sortie
  }
}

export function toggleMusic() {
  if (playing) { stopMusic(); return false; }
  startMusic(); return true;
}

export function isMusicPlaying() { return playing; }
