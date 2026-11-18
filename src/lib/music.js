// Background music: Web Audio so the fade works on iOS (audio.volume is read-only there).
// Seamless loop: each pass overlaps the next by `crossfade` seconds with equal-power curves.
import { MUSIC } from '../config.js';

export class Music {
  constructor(o = MUSIC) {
    this.o = o;
    this.bytes = null;
    this.playing = false;   // user intent (not muted)
    this.started = false;
    this.listeners = new Set();
  }

  /** start downloading early (the <link rel=preload> warms the cache) */
  preload() {
    if (!this._fetch) {
      this._fetch = fetch(this.o.src, { credentials: 'same-origin' })
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => (this.bytes = b))
        .catch((e) => { console.warn('music preload failed', e); return null; });
    }
    return this._fetch;
  }

  on(fn) { this.listeners.add(fn); }
  _emit() { this.listeners.forEach((f) => f(this.playing)); }

  /** MUST be called synchronously inside a user gesture (the seal tap). */
  start() {
    if (this.started) return;
    this.started = true;
    try {
      if (this.o.ignoreSilentSwitch && navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {}
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return this._fallback();
    const ctx = (this.ctx = new AC());
    // unlock on iOS: play one silent frame inside the gesture
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
    ctx.resume && ctx.resume();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.playing = true;
    this._emit();
    this.preload().then(async (bytes) => {
      if (!bytes) return this._fallback();
      try {
        this.buffer = await new Promise((res, rej) => ctx.decodeAudioData(bytes.slice(0), res, rej));
      } catch (e) { console.warn('decode failed', e); return this._fallback(); }
      const now = ctx.currentTime + 0.05;
      this.master.gain.setValueAtTime(0, now);
      if (this.playing) this.master.gain.linearRampToValueAtTime(this.o.volume, now + this.o.fadeIn);
      this._schedule(now, true);
      this._timer = setInterval(() => this._pump(), 500);
    });
    document.addEventListener('visibilitychange', () => this._vis());
    window.addEventListener('pagehide', () => this._vis(true));
  }

  _schedule(when, first) {
    const { ctx, buffer } = this;
    const X = Math.min(this.o.crossfade, buffer.duration / 4);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    src.connect(g).connect(this.master);
    // equal-power envelopes
    const N = 64;
    const fadeIn = new Float32Array(N), fadeOut = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      fadeIn[i] = Math.sin(t * Math.PI / 2);
      fadeOut[i] = Math.cos(t * Math.PI / 2);
    }
    if (first) g.gain.setValueAtTime(1, when);
    else g.gain.setValueCurveAtTime(fadeIn, when, X);
    const endFade = when + buffer.duration - X;
    g.gain.setValueCurveAtTime(fadeOut, endFade, X - 0.01);
    src.start(when);
    src.stop(when + buffer.duration);
    this.nextStart = endFade;
  }

  // schedule the next pass a few seconds ahead (suspended contexts don't advance)
  _pump() {
    if (!this.ctx || !this.buffer) return;
    if (this.ctx.currentTime > this.nextStart - 4) this._schedule(this.nextStart, false);
  }

  _vis(hide) {
    if (!this.ctx) return;
    if (hide || document.hidden) {
      this.ctx.suspend && this.ctx.suspend();
    } else if (this.playing) {
      this.ctx.resume && this.ctx.resume();
    }
  }

  toggle() { this.setPlaying(!this.playing); }

  setPlaying(on) {
    this.playing = on;
    this._emit();
    if (this.el) { on ? this.el.play().catch(() => {}) : this.el.pause(); return; }
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.master.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    if (on) {
      this.ctx.resume();
      g.linearRampToValueAtTime(this.o.volume, t + 0.8);
    } else {
      g.linearRampToValueAtTime(0, t + 0.4);
      clearTimeout(this._sus);
      this._sus = setTimeout(() => { if (!this.playing) this.ctx.suspend(); }, 450);
    }
  }

  // last resort: a looping <audio> element (no crossfade, volume may be ignored on iOS)
  _fallback() {
    if (this.el) return;
    const a = (this.el = new Audio(this.o.src));
    a.loop = true; a.volume = this.o.volume;
    if (this.playing) a.play().catch(() => { this.playing = false; this._emit(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) a.pause(); else if (this.playing) a.play().catch(() => {});
    });
  }
}
