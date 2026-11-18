// Drifting blush/ivory petals, tiny pearls and sparkles, kept inside each section.
import { gsap } from 'gsap';

const R = gsap.utils.random;

function make(kind) {
  const el = document.createElement('span');
  el.className = 'particle particle--' + (kind === 'ivory' ? 'petal particle--ivory' : kind);
  return el;
}

export class Drift {
  /** @param {HTMLElement} layer .sec__fx (taller than the section for parallax) */
  constructor(layer, count = 8) {
    this.layer = layer; this.items = []; this.active = false;
    const kinds = ['petal', 'petal', 'ivory', 'pearl', 'spark', 'petal', 'pearl', 'spark', 'ivory', 'petal'];
    for (let i = 0; i < count; i++) {
      const el = make(kinds[i % kinds.length]);
      layer.appendChild(el);
      this.items.push({ el, tl: null });
    }
    this.ro = new ResizeObserver(() => { this.w = layer.clientWidth; this.h = layer.clientHeight; });
    this.ro.observe(layer);
    this.w = layer.clientWidth; this.h = layer.clientHeight;
  }

  _spawn(it, first) {
    const { el } = it;
    const w = this.w || innerWidth, h = this.h || innerHeight;
    const x0 = R(0.04, 0.96) * w;
    const isSpark = el.classList.contains('particle--spark');
    const y0 = first ? R(0.1, 0.9) * h : R(-0.05, 0.05) * h;
    const dur = isSpark ? R(5, 9) : R(16, 26) * (first ? R(0.4, 1) : 1);
    const s = isSpark ? R(0.5, 1.1) : R(0.6, 1.15);
    gsap.set(el, { x: x0, y: y0, rotation: R(0, 360), scale: s, opacity: 0 });
    const tl = gsap.timeline({ onComplete: () => this._spawn(it, false) });
    if (isSpark) {
      tl.to(el, { opacity: R(0.6, 1), duration: dur * 0.3, ease: 'sine.out' })
        .to(el, { y: y0 - R(20, 50), rotation: '+=90', duration: dur, ease: 'none' }, 0)
        .to(el, { opacity: 0, duration: dur * 0.4, ease: 'sine.in' }, dur * 0.6);
    } else {
      const dy = h * R(0.55, 0.95);
      tl.to(el, { opacity: el.classList.contains('particle--pearl') ? 0.85 : 0.8, duration: 2, ease: 'sine.out' })
        .to(el, { y: y0 + dy, rotation: `+=${R(120, 320) * (Math.random() < 0.5 ? -1 : 1)}`, duration: dur, ease: 'none' }, 0)
        .to(el, { x: x0 + R(-60, 60), duration: dur / 2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0)
        .to(el, { opacity: 0, duration: 2.5, ease: 'sine.in' }, dur - 2.5);
    }
    it.tl = tl;
    if (!this.active) tl.pause();
  }

  setActive(on) {
    if (on === this.active) return;
    this.active = on;
    this.items.forEach((it) => {
      if (on) { if (!it.tl) this._spawn(it, true); else it.tl.resume(); }
      else if (it.tl) it.tl.pause();
    });
  }
}

/** One-off burst of pearls / petals / sparkles from a point (px within container). */
export function burst(container, x, y, o = {}) {
  const n = o.count ?? 18;
  const kinds = o.kinds ?? ['pearl', 'spark', 'pearl', 'spark', 'petal'];
  const spread = o.spread ?? 90;
  for (let i = 0; i < n; i++) {
    const el = make(kinds[i % kinds.length]);
    el.style.zIndex = 9;
    container.appendChild(el);
    const a = R(0, Math.PI * 2), d = R(spread * 0.35, spread);
    gsap.set(el, { x, y, scale: R(0.5, 1.1), opacity: 1, rotation: R(0, 360) });
    gsap.timeline({ onComplete: () => el.remove() })
      .to(el, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8 - R(10, 40), duration: R(0.5, 0.9), ease: 'power3.out' })
      .to(el, { y: `+=${R(30, 90)}`, opacity: 0, rotation: '+=120', duration: R(0.8, 1.4), ease: 'power1.in' }, '>-0.15');
  }
}

/** a few sparkles rising (used when the photo is revealed) */
export function rise(container, rect, n = 8) {
  for (let i = 0; i < n; i++) {
    const el = make(i % 3 === 0 ? 'pearl' : 'spark');
    el.style.zIndex = 9;
    container.appendChild(el);
    const x = rect.x + R(0, rect.w), y = rect.y + rect.h * R(0.5, 1);
    gsap.set(el, { x, y, scale: R(0.6, 1.2), opacity: 0 });
    gsap.timeline({ delay: R(0, 0.6), onComplete: () => el.remove() })
      .to(el, { opacity: 1, duration: 0.3 })
      .to(el, { y: y - R(60, 140), x: x + R(-20, 20), duration: R(1.6, 2.4), ease: 'sine.out' }, 0)
      .to(el, { opacity: 0, duration: 0.8 }, '>-0.8');
  }
}
