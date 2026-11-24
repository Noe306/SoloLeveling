/* ==========================================================================
   audio.js: procedural sound effects via the Web Audio API (no files).
   playSound('coin' | 'fanfare' | 'bell' | 'kaching')
   ========================================================================== */

var audioCtx = null;

// Browsers only allow audio after a user gesture, so create the context lazily.
function getAudioCtx() {
  if (!audioCtx) {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// One enveloped oscillator note. `when` is seconds from now.
function tone(freq, when, dur, type, vol) {
  var ctx = getAudioCtx();
  if (!ctx) return;
  var t0 = ctx.currentTime + when;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

var SOUNDS = {
  // Soft two-note "System" ping used for notifications.
  system: function () {
    tone(659, 0, 0.5, 'sine', 0.12); tone(988, 0.12, 0.7, 'sine', 0.1);
    tone(1319, 0.12, 0.7, 'triangle', 0.04);
  },
  // Two quick rising notes: a coin pickup.
  coin: function () { tone(988, 0, 0.09, 'square', 0.08); tone(1319, 0.08, 0.28, 'square', 0.08); },
  // Rising major arpeggio: level up / evolution.
  fanfare: function () {
    [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.11, 0.35, 'triangle', 0.16); });
    tone(1047, 0.6, 0.7, 'sine', 0.1);
  },
  // Soft bell with a few partials: timer complete.
  bell: function () {
    [880, 1760, 2640].forEach(function (f, i) { tone(f, 0, 1.6 - i * 0.4, 'sine', 0.12 / (i + 1)); });
    tone(880, 0.55, 1.4, 'sine', 0.08);
  },
  // Cash register: shop purchase.
  kaching: function () {
    tone(1568, 0, 0.07, 'square', 0.07);
    tone(2093, 0.07, 0.12, 'square', 0.07);
    tone(2637, 0.16, 0.4, 'triangle', 0.1);
  }
};

function playSound(name) {
  if (gameState.settings.muted) return;
  try { if (SOUNDS[name]) SOUNDS[name](); } catch (e) { /* audio is optional */ }
}
