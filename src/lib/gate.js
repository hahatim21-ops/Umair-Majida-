// Page 1 – the gate. Tap the seal: a soft gold pulse radiates from it, then the
// curtain is drawn across to the right, gathering into folds, onto the invitation.
import { gsap } from 'gsap';

export function initGate({ music, calm, getSway, onOpenStart, onOpened }) {
  const gate = document.getElementById('gate');
  const col = gate.querySelector('.gate__col');
  const box = gate.querySelector('.gate__box');
  const btn = document.getElementById('seal-btn');
  const hint = document.getElementById('gate-hint');
  const ring = gate.querySelector('.seal-ring');

  const burst = Object.assign(document.createElement('div'), { className: 'seal-burst' });
  const glow = Object.assign(document.createElement('div'), { className: 'seal-glow' });
  burst.setAttribute('aria-hidden', 'true');
  glow.setAttribute('aria-hidden', 'true');
  box.append(glow, burst);

  const ready = () => {
    gsap.to(hint, { opacity: 1, duration: 1.2, delay: 1, ease: 'sine.out' });
  };

  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    btn.disabled = true;
    music.start();                       // inside the tap: browsers allow audio now
    onOpenStart && onOpenStart();

    if (calm) {
      gsap.timeline({ onComplete: finish })
        .to(gate, { opacity: 0, duration: 0.9, ease: 'sine.inOut' })
        .add(() => onOpened && onOpened('reveal'), 0);
      return;
    }

    // stop the CSS breathing loop first, otherwise it overrides the fade
    const ringOpacity = getComputedStyle(ring).opacity;
    ring.style.animation = 'none';

    const sway = getSway && getSway();
    const useGL = !!(sway && sway.ready && !sway.disposed);
    const DRAW = 2.3;

    const tl = gsap.timeline({ onComplete: finish });
    // 1. the seal answers the tap: a press, a glow and a gold ring radiating out
    tl.fromTo(ring, { opacity: ringOpacity }, { opacity: 0, duration: 0.35 }, 0)
      .to(hint, { opacity: 0, duration: 0.4 }, 0)
      .fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'sine.out' }, 0)
      .to(glow, { opacity: 0, scale: 1.3, duration: 0.9, ease: 'sine.in' }, 0.35)
      .fromTo(burst, { opacity: 1, scale: 0.95 }, { opacity: 0, scale: 2.1, duration: 1.0, ease: 'power2.out' }, 0.05);

    // 2. the curtain is drawn aside to the right, revealing the invitation beneath
    const T0 = 0.45;
    tl.add(() => onOpened && onOpened('reveal'), T0);
    if (useGL) {
      sway.keep = true;
      sway.active = true;
      const st = { p: 0 };
      tl.add(() => {
        // the canvas now carries the image; hide the static copy and the seal UI
        box.querySelector('picture').style.visibility = 'hidden';
        btn.style.visibility = 'hidden';
      }, T0)
        .to(st, { p: 1, duration: DRAW, ease: 'power2.inOut', onUpdate: () => { sway.draw = st.p; } }, T0);
    } else {
      // no WebGL: slide the curtain across and squeeze it into the right edge
      tl.to(col, { xPercent: 100, scaleX: 0.6, transformOrigin: '100% 50%', duration: DRAW, ease: 'power2.inOut' }, T0)
        .to(col, { opacity: 0, duration: 0.5 }, T0 + DRAW - 0.5);
    }
  };

  function finish() {
    gate.remove();
    onOpened && onOpened('done');
  }

  btn.addEventListener('click', open);
  return { ready, open };
}
