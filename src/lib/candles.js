// Animated flames placed exactly on the painted flames, plus the lighting sequence:
// card dimmed to ~55% → flames light from the outer candles inward (each with a spark)
// → a warm glow spreads and the dimming fades out over ~1.8s → flames keep flickering.
import { gsap } from 'gsap';

let uid = 0;
const flameSvg = () => {
  const id = 'fg' + (uid++);
  return `<svg viewBox="0 0 20 40" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <radialGradient id="${id}o" cx="50%" cy="72%" r="62%">
      <stop offset="0" stop-color="#fff7da" stop-opacity="1"/>
      <stop offset=".45" stop-color="#ffd27a" stop-opacity=".95"/>
      <stop offset=".8" stop-color="#f09a3a" stop-opacity=".75"/>
      <stop offset="1" stop-color="#d8701f" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}i" cx="50%" cy="75%" r="45%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".6" stop-color="#fff3c8" stop-opacity=".9"/>
      <stop offset="1" stop-color="#ffe7a0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M10 1 C 13 9, 19 17, 18.5 26 C 18 34, 14 39, 10 39 C 6 39, 2 34, 1.5 26 C 1 17, 7 9, 10 1 Z" fill="url(#${id}o)"/>
  <path d="M10 13 C 12 18, 15 23, 14.5 29 C 14 34, 12 37, 10 37 C 8 37, 6 34, 5.5 29 C 5 23, 8 18, 10 13 Z" fill="url(#${id}i)"/>
</svg>`;
};

export class Candles {
  /**
   * @param {HTMLElement} box card box (positioned, aspect = image)
   * @param {Array<{x,y,h}>} flames  % coords
   * @param {object} o { calm, warmSpots: css gradients }
   */
  constructor(box, flames, o = {}) {
    this.box = box; this.calm = !!o.calm;
    this.dim = Object.assign(document.createElement('div'), { className: 'dim' });
    this.warm = Object.assign(document.createElement('div'), { className: 'warm' });
    this.warm.style.background = o.warm || '';
    this.layer = Object.assign(document.createElement('div'), { className: 'flames' });
    this.layer.setAttribute('aria-hidden', 'true');
    box.append(this.dim, this.warm, this.layer);

    // flame elements; light order: outermost (furthest from centre line) first
    this.items = flames.map((f) => {
      const el = document.createElement('div');
      el.className = 'flame';
      // the overlay flame is ~1.25x the painted one so the painted flame never peeks out
      el.style.cssText = `left:${f.x}%;top:${f.y}%;--h:${(f.h * 1.25).toFixed(2)}`;
      el.innerHTML = `<div class="flame__glow"></div><div class="flame__spark"></div><div class="flame__body">${flameSvg()}</div>`;
      this.layer.appendChild(el);
      return { el, f, body: el.querySelector('.flame__body'), glow: el.querySelector('.flame__glow'), spark: el.querySelector('.flame__spark'), tl: null };
    });
    this.order = this.items.slice().sort((a, b) => Math.abs(b.f.x - 50) - Math.abs(a.f.x - 50));
    this.lit = false; this.running = false;

    if (this.calm) {
      // static glow only
      this.items.forEach((it) => it.el.classList.add('is-lit'));
      gsap.set(this.warm, { opacity: 0.55 });
      this.lit = true;
    } else {
      gsap.set(this.dim, { opacity: 0.45 }); // ≈ 55% brightness
    }
  }

  light() {
    if (this.lit) return;
    this.lit = true;
    const tl = gsap.timeline();
    const step = Math.min(0.09, 1.6 / Math.max(1, this.order.length));
    this.order.forEach((it, i) => {
      const t = i * step;
      tl.fromTo(it.spark, { scale: 0, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.45, ease: 'power2.out' }, t)
        .fromTo(it.body, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' }, t + 0.05)
        .fromTo(it.glow, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, t + 0.05);
    });
    const after = this.order.length * step + 0.25;
    tl.to(this.warm, { opacity: 0.6, duration: 1.8, ease: 'sine.inOut' }, after - 0.3)
      .to(this.dim, { opacity: 0, duration: 1.8, ease: 'sine.inOut' }, after)
      .add(() => { this.items.forEach((it) => it.el.classList.add('is-lit')); this.flicker(true); });
    this.seq = tl;
  }

  /** random flicker via scale, skew and opacity */
  flicker(on) {
    if (this.calm) return;
    this.running = on;
    if (!this.lit) return;
    this.items.forEach((it) => {
      if (on) {
        if (it.tl) { it.tl.resume(); return; }
        const loop = () => {
          if (!this.running) return;
          it.tl = gsap.to(it.body, {
            scaleY: gsap.utils.random(0.86, 1.12),
            scaleX: gsap.utils.random(0.88, 1.06),
            skewX: gsap.utils.random(-7, 7),
            opacity: gsap.utils.random(0.82, 1),
            duration: gsap.utils.random(0.07, 0.22),
            ease: 'sine.inOut',
            onComplete: () => { it.tl = null; loop(); },
          });
          gsap.to(it.glow, { opacity: gsap.utils.random(0.75, 1), scale: gsap.utils.random(0.94, 1.06), duration: 0.25, overwrite: true });
        };
        loop();
      } else if (it.tl) {
        it.tl.pause();
      }
    });
  }
}
