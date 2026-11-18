// Painted text that writes itself in, line by line.
// Each card shows a text-free plate; every text line is a slice of the original card
// laid exactly over it, revealed with a soft ink wipe. Lines are listed (in % of the
// image) in src/data/lines.json.
import { gsap } from 'gsap';

const PADX = 0.6, PADY = 0.25; // must match scripts/derive_blanks.py padding (or sit inside it)

export class TextLines {
  constructor(box, lines, { calm = false } = {}) {
    this.calm = calm;
    this.layer = document.createElement('div');
    this.layer.className = 'text-lines';
    this.layer.setAttribute('aria-hidden', 'true');
    this.items = lines.map(({ box: [x, y, w, h], fx }) => {
      const X = Math.max(0, x - PADX), Y = Math.max(0, y - PADY);
      const W = Math.min(100 - X, w + 2 * PADX), H = Math.min(100 - Y, h + 2 * PADY);
      const el = document.createElement('div');
      el.className = `tl tl--${fx}`;
      el.style.cssText = `left:${X}%;top:${Y}%;width:${W}%;height:${H}%;` +
        `background-size:${(100 / W) * 100}% ${(100 / H) * 100}%;` +
        `background-position:${W < 100 ? (X / (100 - W)) * 100 : 0}% ${H < 100 ? (Y / (100 - H)) * 100 : 0}%`;
      this.layer.appendChild(el);
      return { el, fx, w };
    });
    box.appendChild(this.layer);
    this.played = false;
  }

  /** point the slices at the full card image (same size/format as the plate) */
  setSource(url) {
    this.src = url;
    this.items.forEach(({ el }) => (el.style.backgroundImage = `url("${url}")`));
  }

  play(delay = 0) {
    if (this.played) return;
    this.played = true;
    if (this.calm) {
      this.items.forEach(({ el }) => el.classList.add('is-done'));
      return;
    }
    const tl = gsap.timeline({ delay });
    let t = 0;
    this.items.forEach(({ el, fx, w }) => {
      const long = fx === 'script' ? 1.5 : fx === 'rise' ? 0.9 : 0.55 + w / 100;
      if (fx === 'rise') {
        tl.fromTo(el, { '--p': '120%', opacity: 0, y: 10, filter: 'blur(6px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: long, ease: 'power2.out' }, t);
      } else {
        tl.fromTo(el, { '--p': '-25%', filter: 'blur(5px)' },
          { '--p': '125%', filter: 'blur(0px)', duration: long, ease: fx === 'script' ? 'sine.inOut' : 'power1.inOut' }, t);
      }
      tl.add(() => el.classList.add('is-done'), t + long);
      t += fx === 'script' ? 0.55 : 0.26;
    });
    this.tl = tl;
  }
}
