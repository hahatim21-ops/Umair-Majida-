// Star glints that travel along traced pearl strands (screen blend) + random twinkles.
import { gsap } from 'gsap';

const R = gsap.utils.random;

// Catmull-Rom → dense polyline, with cumulative lengths in aspect-correct units
function sample(points, ar) {
  const P = points.map(([x, y]) => [x, y / ar]); // y in width units
  const out = [];
  const seg = 14;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P[P.length - 1]);
  const len = [0];
  for (let i = 1; i < out.length; i++) len.push(len[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { pts: out.map(([x, y]) => [x, y * ar]), len, total: len[len.length - 1] };
}

function at(path, u) {
  const L = u * path.total;
  let i = 1;
  while (i < path.len.length - 1 && path.len[i] < L) i++;
  const a = path.len[i - 1], b = path.len[i];
  const k = b > a ? (L - a) / (b - a) : 0;
  const p = path.pts[i - 1], q = path.pts[i];
  return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
}

export class Glints {
  constructor(box, strand, ar, o = {}) {
    this.box = box; this.active = false;
    this.paths = strand.paths.map((p) => sample(p, ar));
    this.studs = strand.studs || [];
    this.layer = Object.assign(document.createElement('div'), { className: 'glints' });
    this.layer.setAttribute('aria-hidden', 'true');
    box.appendChild(this.layer);
    const nTravel = o.travel ?? Math.min(3, this.paths.length);
    const nTw = o.twinkles ?? 5;
    this.travellers = Array.from({ length: nTravel }, () => this._el('glint'));
    this.twinkles = Array.from({ length: nTw }, () => this._el('glint glint--tw'));
    this.tweens = [];
    this.ro = new ResizeObserver(() => { this.w = box.clientWidth; this.h = box.clientHeight; });
    this.ro.observe(box);
    this.w = box.clientWidth; this.h = box.clientHeight;
  }

  _el(cls) {
    const el = document.createElement('span');
    el.className = cls;
    this.layer.appendChild(el);
    return el;
  }

  _place(el, [x, y]) { gsap.set(el, { x: (x / 100) * this.w, y: (y / 100) * this.h }); }

  _travel(el, delay) {
    const path = this.paths[(Math.random() * this.paths.length) | 0];
    const rev = Math.random() < 0.5;
    const o = { u: 0 };
    const dur = R(3.2, 5.5) * Math.max(0.6, Math.min(1.6, path.total / 40));
    const tw = gsap.to(o, {
      u: 1, duration: dur, delay, ease: 'sine.inOut',
      onUpdate: () => {
        const u = rev ? 1 - o.u : o.u;
        this._place(el, at(path, u));
        const env = Math.sin(Math.PI * o.u);
        el.style.opacity = (env * 0.95).toFixed(3);
        el.style.scale = (0.55 + 0.45 * env).toFixed(3);
      },
      onComplete: () => this._travel(el, R(0.4, 2.8)),
    });
    this.tweens = this.tweens.filter((t) => t.progress() < 1);
    this.tweens.push(tw);
    if (!this.active) tw.pause();
  }

  _twinkle(el, delay) {
    let p;
    if (this.studs.length && Math.random() < 0.35) p = this.studs[(Math.random() * this.studs.length) | 0];
    else p = at(this.paths[(Math.random() * this.paths.length) | 0], Math.random());
    this._place(el, p);
    const tw = gsap.timeline({ delay, onComplete: () => this._twinkle(el, R(0.6, 3.5)) })
      .fromTo(el, { opacity: 0, scale: 0.2, rotation: 0 }, { opacity: 1, scale: R(0.7, 1.1), rotation: 45, duration: 0.45, ease: 'sine.out' })
      .to(el, { opacity: 0, scale: 0.2, rotation: 90, duration: 0.6, ease: 'sine.in' });
    this.tweens = this.tweens.filter((t) => t.progress() < 1);
    this.tweens.push(tw);
    if (!this.active) tw.pause();
  }

  setActive(on) {
    if (on === this.active) return;
    this.active = on;
    if (on && !this.started) {
      this.started = true;
      this.travellers.forEach((el, i) => this._travel(el, i * 1.3 + R(0, 0.8)));
      this.twinkles.forEach((el) => this._twinkle(el, R(0, 2.5)));
      return;
    }
    this.tweens = this.tweens.filter((t) => t.isActive() || t.paused() || t.progress() < 1);
    this.tweens.forEach((t) => (on ? t.resume() : t.pause()));
  }
}
