// Canvas scratch-off layer (pointer events: mouse, touch and pen).
// Only the scratch element has touch-action:none; Lenis is paused while a pointer is down.
import { dpr } from './env.js';

export class Scratch {
  /**
   * @param {HTMLElement} el      positioned wrapper (.scratch); canvas fills it
   * @param {object} o
   *   shape: 'circle' | 'ellipse'
   *   draw(ctx, w, h): paints the cover (already clipped to the shape)
   *   threshold: fraction cleared before auto-reveal (0.5–0.55)
   *   brush: brush radius as a fraction of the element's smaller side
   *   onStart(), onReveal(), lenis
   */
  constructor(el, o) {
    this.el = el; this.o = Object.assign({ shape: 'circle', threshold: 0.52, brush: 0.16 }, o);
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.revealed = false; this.started = false; this.down = false; this.last = null;
    this._lastCheck = 0;
    this._bind();
    this.ro = new ResizeObserver(() => this._resize());
    this.ro.observe(el);
    this._resize(true);
  }

  _resize(first) {
    const r = this.el.getBoundingClientRect();
    if (!r.width) return;
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (!first && w === this.canvas.width && h === this.canvas.height) return;
    // keep already-scratched pixels when the layout changes
    let prev = null;
    if (!first && this.canvas.width && this.started) {
      prev = document.createElement('canvas');
      prev.width = this.canvas.width; prev.height = this.canvas.height;
      prev.getContext('2d').drawImage(this.canvas, 0, 0);
    }
    this.canvas.width = w; this.canvas.height = h;
    this.w = w; this.h = h;
    if (!this.revealed) this.paint(prev);
  }

  _clip(ctx) {
    const { w, h } = this;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
  }

  paint(prev) {
    const { ctx, w, h } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    this._clip(ctx); ctx.clip();
    this.o.draw(ctx, w, h);
    ctx.restore();
    if (prev) {
      // re-apply the scratched area: anything transparent in prev stays transparent
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(prev, 0, 0, w, h);
      ctx.restore();
    }
  }

  redraw() { if (!this.revealed && !this.started) this.paint(); }

  _bind() {
    const c = this.el;
    const pos = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (this.w / r.width), y: (e.clientY - r.top) * (this.h / r.height) };
    };
    c.addEventListener('pointerdown', (e) => {
      if (this.revealed) return;
      if (e.button !== undefined && e.button > 0) return;
      e.preventDefault();
      this.down = true;
      try { c.setPointerCapture(e.pointerId); } catch {}
      this.o.lenis && this.o.lenis.stop();
      if (!this.started) { this.started = true; this.o.onStart && this.o.onStart(); }
      this.last = pos(e);
      this._dab(this.last, this.last);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.down || this.revealed) return;
      e.preventDefault();
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of events.length ? events : [e]) {
        const p = pos(ev);
        this._dab(this.last, p);
        this.last = p;
      }
      this._maybeCheck();
    });
    const end = () => {
      if (!this.down) return;
      this.down = false;
      this.o.lenis && this.o.lenis.start();
      this._check();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('lostpointercapture', end);
    // stop iOS from scrolling/zooming when the gesture starts on the canvas
    c.addEventListener('touchstart', (e) => { if (!this.revealed) e.preventDefault(); }, { passive: false });
  }

  _dab(a, b) {
    const { ctx } = this;
    const R = Math.min(this.w, this.h) * this.o.brush;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / (R * 0.35)));
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i <= steps; i++) {
      const x = a.x + (b.x - a.x) * (i / steps), y = a.y + (b.y - a.y) * (i / steps);
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _maybeCheck() {
    const now = performance.now();
    if (now - this._lastCheck > 160) { this._lastCheck = now; this._check(); }
  }

  /** fraction of the shape that is (mostly) cleared */
  progress() {
    const { w, h } = this;
    if (!w || !h) return 0;
    const data = this.ctx.getImageData(0, 0, w, h).data;
    const step = Math.max(2, Math.round(Math.min(w, h) / 70));
    let total = 0, clear = 0;
    const cx = w / 2, cy = h / 2;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        const dx = (x - cx) / cx, dy = (y - cy) / cy;
        if (dx * dx + dy * dy > 0.92) continue; // ignore the rim
        total++;
        if (data[((y | 0) * w + (x | 0)) * 4 + 3] < 96) clear++;
      }
    }
    return total ? clear / total : 0;
  }

  _check() {
    if (this.revealed) return;
    if (this.progress() >= this.o.threshold) this.reveal();
  }

  reveal(opts = {}) {
    if (this.revealed) return;
    this.revealed = true; this.down = false;
    this.o.lenis && this.o.lenis.start();
    this.el.style.pointerEvents = 'none';
    this.el.style.touchAction = 'auto';
    this.o.onReveal && this.o.onReveal(opts);
  }
}
