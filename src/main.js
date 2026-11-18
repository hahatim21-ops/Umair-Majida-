import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/pinyon-script/latin-400.css';
import 'lenis/dist/lenis.css';
import './style.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { MAP_URL, ICS_PATH, googleCalendarUrl } from './config.js';
import { calm } from './lib/env.js';
import { Sway, tickAll } from './lib/sway.js';
import { Glints } from './lib/glints.js';
import { Drift, burst, rise } from './lib/particles.js';
import { Candles } from './lib/candles.js';
import { Scratch } from './lib/scratch.js';
import { Music } from './lib/music.js';
import { initGate } from './lib/gate.js';
import { TextLines } from './lib/lines.js';
import LINES from './data/lines.json';
import { STRANDS } from './data/strands.js';
import { FRAMES, OVAL, EXTRA_ZONES } from './data/layout.js';
import flames5 from './data/flames/UM_5.json';
import flames6 from './data/flames/UM_6.json';

gsap.registerPlugin(ScrollTrigger);
const html = document.documentElement;
html.classList.add('is-locked');
if (calm) html.classList.add('calm');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const debug = (window.__invite = { calm });

// Card images carry data-src/data-srcset so nothing below the gate competes with the
// first view; they are filled in just ahead of need.
function hydrate(scope) {
  scope.querySelectorAll('source[data-srcset]').forEach((el) => { el.srcset = el.dataset.srcset; delete el.dataset.srcset; });
  scope.querySelectorAll('img[data-srcset]').forEach((el) => { el.srcset = el.dataset.srcset; delete el.dataset.srcset; });
  scope.querySelectorAll('img[data-src]').forEach((el) => { el.src = el.dataset.src; delete el.dataset.src; });
}

// ── Smooth scroll (wheel only; touch stays native) ────────────────────────────
let lenis = null;
if (!calm) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: false });
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
}
debug.lenis = lenis;
gsap.ticker.add((time) => {
  lenis && lenis.raf(time * 1000);
  tickAll(performance.now());
});
gsap.ticker.lagSmoothing(0);

// ── Music ─────────────────────────────────────────────────────────────────────
const music = new Music();
music.preload();
debug.music = music;
const musicBtn = $('#music-btn');
music.on((playing) => {
  musicBtn.setAttribute('aria-pressed', String(playing));
  musicBtn.setAttribute('aria-label', playing ? 'Mute music' : 'Play music');
});
musicBtn.addEventListener('click', () => music.toggle());

// ── Sections ──────────────────────────────────────────────────────────────────
const sections = $$('.sec').map((sec) => {
  const key = sec.dataset.key;
  const box = $('.card-box', sec);
  const img = $('picture img', box);
  const ar = parseFloat(getComputedStyle(sec).getPropertyValue('--ar')) || 0.5625;
  return { sec, key, box, img, ar, card: $('.card', sec), fx: $('.sec__fx', sec), parts: [] };
});
debug.sections = sections;

const MASK = { um2: 'UM_2', um3: 'UM_3', um4: 'UM_4', um5: 'UM_5', um6: 'UM_6' };
function ensureSway(s) {
  if (calm || s.sway) return;
  s.sway = new Sway(s.box, s.img, `/assets/masks/${MASK[s.key]}.png`, { amp: 5, after: $('picture', s.box) });
  s.parts.push(s.sway);
}

for (const s of sections) {
  if (!calm) {
    const g = new Glints(s.box, STRANDS[s.key], s.ar, { travel: s.key === 'um5' ? 2 : 3, twinkles: s.key === 'um4' ? 6 : 4 });
    const d = new Drift(s.fx, 8);
    s.parts.push(g, d);
  }
}

// Painted text writes itself in, line by line, over the card's text-free plate
for (const s of sections) {
  if (!LINES[s.key]) continue;
  s.lines = new TextLines(s.box, LINES[s.key], { calm });
}
// the slices use the full card at the same size/format the browser picked for the plate
function fullSrc(s) {
  const src = s.img.currentSrc || s.img.src;
  return src ? src.replace(/(um\d)blank-/, '$1-') : '';
}
async function linesReady(s) {
  if (!s.lines) return false;
  if (!s.img.complete || !s.img.naturalWidth) await new Promise((r) => s.img.addEventListener('load', r, { once: true }));
  const url = fullSrc(s);
  await new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = url; });
  s.lines.setSource(url);
  return true;
}
for (const s of sections) {
  if (!s.lines || s.key === 'um2') continue;   // UM_2 starts with the gate opening
  ScrollTrigger.create({
    trigger: s.sec, start: 'top 72%', once: true,
    onEnter: () => linesReady(s).then(() => s.lines.play(0.1)),
  });
}

// Candles (UM_5 candelabras + corner lights, UM_6 lanterns)
const s5 = sections.find((s) => s.key === 'um5');
const s6 = sections.find((s) => s.key === 'um6');
s5.candles = new Candles(s5.box, flames5.flames, {
  calm,
  warm: 'radial-gradient(30% 22% at 6% 54%, rgba(255,190,110,.9), transparent), radial-gradient(30% 22% at 94% 54%, rgba(255,190,110,.9), transparent), radial-gradient(34% 16% at 18% 82%, rgba(255,186,100,.9), transparent), radial-gradient(34% 16% at 84% 82%, rgba(255,186,100,.9), transparent)',
});
s6.candles = new Candles(s6.box, flames6.flames, {
  calm,
  warm: 'radial-gradient(30% 14% at 12% 94%, rgba(255,186,100,.9), transparent), radial-gradient(30% 14% at 88% 94%, rgba(255,186,100,.9), transparent)',
});
for (const s of [s5, s6]) {
  s.parts.push({ setActive: (on) => s.candles.flicker(on) });
  ScrollTrigger.create({ trigger: s.box, start: 'top 62%', once: true, onEnter: () => s.candles.light() });
}

// Activate effects only for sections on screen
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const s = sections.find((x) => x.sec === e.target);
    // edge-touching sections report isIntersecting with a zero ratio: treat as off screen
    s.visible = e.isIntersecting && e.intersectionRatio > 0;
    s.parts.forEach((p) => p.setActive(s.visible));
  }
}, { threshold: [0, 0.01] });
// create the WebGL sway a little ahead of time
const pre = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const s = sections.find((x) => x.sec === e.target);
    ensureSway(s);
    if (s.visible) s.sway && s.sway.setActive(true);
    pre.unobserve(e.target);
  }
}, { rootMargin: '60% 0px' });
sections.forEach((s) => { io.observe(s.sec); pre.observe(s.sec); });

// ── Parallax + entrances ─────────────────────────────────────────────────────
// Cards sit edge to edge, so the cards themselves never move (that would open gaps);
// the particle layer drifts at ~1.2x and the side backdrop follows the page in view.
if (!calm) {
  for (const s of sections) {
    const span = () => innerHeight + s.sec.offsetHeight;
    gsap.fromTo(s.fx, { y: () => 0.08 * span() }, {
      y: () => -0.08 * span(), ease: 'none',
      scrollTrigger: { trigger: s.sec, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
  }
}
// No entrance fades or zooms: every page is always shown at full strength.

// side backdrop (visible beside the column on wide screens) follows the page in view
const stageBds = $$('.stage__bd');
function setStage(key) { stageBds.forEach((d) => d.classList.toggle('is-on', d.dataset.key === key)); }
for (const s of sections) {
  ScrollTrigger.create({ trigger: s.sec, start: 'top 55%', end: 'bottom 55%', onToggle: (st) => st.isActive && debug.opened && setStage(s.key) });
}

// the music toggle steps aside while painted text (or a button) passes beneath it
const zonesFor = (key) => [...(LINES[key] || []).map((l) => l.box), ...(EXTRA_ZONES[key] || [])];
let asideRaf = 0;
function checkToggle() {
  asideRaf = 0;
  if (musicBtn.hidden) return;
  const t = musicBtn.getBoundingClientRect();
  const pad = 6;
  let over = false;
  for (const s of sections) {
    if (!s.visible) continue;
    const r = s.box.getBoundingClientRect();
    const view = $('.card__view', s.sec).getBoundingClientRect();
    for (const [x, y, w, h] of zonesFor(s.key)) {
      const L = Math.max(r.left + (x / 100) * r.width, view.left), R = Math.min(r.left + ((x + w) / 100) * r.width, view.right);
      const T = Math.max(r.top + (y / 100) * r.height, view.top), B = Math.min(r.top + ((y + h) / 100) * r.height, view.bottom);
      if (L < t.right + pad && R > t.left - pad && T < t.bottom + pad && B > t.top - pad) { over = true; break; }
    }
    if (over) break;
  }
  musicBtn.classList.toggle('is-aside', over);
}
const queueToggle = () => { if (!asideRaf) asideRaf = requestAnimationFrame(checkToggle); };
window.addEventListener('scroll', queueToggle, { passive: true });
window.addEventListener('resize', queueToggle);
debug.checkToggle = checkToggle;

// ── UM_2: text lines + scroll cue ───────────────────────────────────────────────
const s2 = sections[0];
const cue = $('#scroll-btn');
const s2Ready = { p: null };
function revealInvitation() {
  (s2Ready.p || linesReady(s2)).then(() => s2.lines.play(calm ? 0 : 0.5));
}
function showScrollButton() {
  cue.classList.add('is-on');
  gsap.fromTo(cue, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' });
}
cue.addEventListener('click', () => {
  const target = s3.sec;
  if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 3) });
  else target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth' });
  hideCue();
});
let cueHidden = false;
function hideCue() {
  if (cueHidden) return;
  cueHidden = true;
  gsap.to(cue, { opacity: 0, y: 8, duration: 0.5, onComplete: () => cue.remove() });
}

// ── Gate ─────────────────────────────────────────────────────────────────────
const gate = initGate({
  music, calm,
  onOpenStart: () => { hydrate(s3.sec); loadDiscs(); },
  onOpened: (phase) => {
    if (phase === 'reveal') { revealInvitation(); setStage('um2'); }
    if (phase === 'done') {
      html.classList.remove('is-locked');
      document.body.classList.remove('is-locked');
      window.scrollTo(0, 0);
      lenis && lenis.start();
      ScrollTrigger.refresh();
      musicBtn.hidden = false;
      queueToggle();
      gsap.fromTo(musicBtn, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' });
      showScrollButton();
      const onScroll = () => { if (window.scrollY > 60) { hideCue(); window.removeEventListener('scroll', onScroll); } };
      window.addEventListener('scroll', onScroll, { passive: true });
      debug.opened = true;
      // lazy-load the remaining cards about a screen and a half ahead of the scroll
      const ahead = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { hydrate(e.target); ahead.unobserve(e.target); if (e.target === s3.sec) loadDiscs(); } });
      }, { rootMargin: '150% 0px' });
      sections.slice(1).forEach((s) => ahead.observe(s.sec));
    }
  },
});
debug.gate = gate;

// Loader: wait for the gate image (and give the audio a head start)
(async () => {
  const gateImg = $('#gate-img');
  const imgReady = gateImg.decode ? gateImg.decode().catch(() => {}) : new Promise((r) => (gateImg.complete ? r() : gateImg.addEventListener('load', r, { once: true })));
  await imgReady;
  await Promise.race([music.preload(), new Promise((r) => setTimeout(r, 2500))]);
  $('#loader').classList.add('is-done');
  setTimeout(() => $('#loader').remove(), 800);
  gate.ready();
  hydrate(s2.sec); // the invitation sits right under the gate
  s2Ready.p = linesReady(s2);
  ensureSway(s2);
})();

// ── Page 3: scratch the date ─────────────────────────────────────────────────
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
let discResolve;
const discsReady = new Promise((r) => (discResolve = r));
let discsRequested = false;
function loadDiscs() {
  if (discsRequested) return;
  discsRequested = true;
  Promise.all([1, 2, 3].map((n) => loadImg(`/assets/img/disc-${n}.webp`))).then(discResolve);
}
const vibrate = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

function boxPoint(box, xPct, yPct) { return { x: (xPct / 100) * box.clientWidth, y: (yPct / 100) * box.clientHeight }; }

const s3 = sections.find((s) => s.key === 'um3');
const AR3 = 1672 / 941;
const discs = FRAMES.map((f, i) => {
  const r = f.r + 0.07; // tuck ~1px under the gold ring
  const wrap = document.createElement('div');
  wrap.className = 'scratch scratch--disc';
  wrap.style.cssText = `left:${f.cx - r}%;top:${f.cy - r * AR3}%;width:${2 * r}%;height:${2 * r * AR3}%`;
  wrap.setAttribute('aria-hidden', 'true');
  const sheen = Object.assign(document.createElement('div'), { className: 'scratch__sheen' });
  sheen.style.setProperty('--sheen-delay', `${i * 0.5}s`);
  const glow = Object.assign(document.createElement('div'), { className: 'frame-glow' });
  const gr = f.r * 1.16;
  glow.style.cssText = `left:${f.cx - gr}%;top:${f.cy - gr * AR3}%;width:${2 * gr}%;height:${2 * gr * AR3}%`;
  s3.box.append(glow, wrap);
  let disc = null;
  const sc = new Scratch(wrap, {
    shape: 'circle', threshold: 0.52, brush: 0.17, lenis,
    draw(ctx, w, h) {
      if (disc) ctx.drawImage(disc, -1, -1, w + 2, h + 2);
      else { ctx.fillStyle = '#e9e2e4'; ctx.fillRect(0, 0, w, h); }
      // faint inner shadow so the pearl looks set into the frame
      const g = ctx.createRadialGradient(w / 2, h * 0.47, w * 0.36, w / 2, h / 2, w * 0.5);
      g.addColorStop(0, 'rgba(70,45,10,0)');
      g.addColorStop(0.8, 'rgba(70,45,10,.12)');
      g.addColorStop(1, 'rgba(70,45,10,.42)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    },
    onStart: () => gsap.to(sheen, { opacity: 0, duration: 0.4 }),
    onReveal: (o) => {
      gsap.to(sheen, { opacity: 0, duration: 0.3 });
      gsap.to(sc.canvas, { opacity: 0, scale: 1.08, duration: o.quiet ? 0.6 : 0.75, ease: 'power2.out' });
      if (!calm) {
        const p = boxPoint(s3.box, f.cx, f.cy);
        burst(s3.box, p.x, p.y, { count: 14, spread: s3.box.clientWidth * 0.09, kinds: ['pearl', 'spark', 'spark'] });
      }
      if (!o.quiet) vibrate(25);
      checkDate();
    },
  });
  wrap.appendChild(sheen);
  discsReady.then((ims) => { disc = ims[i]; sc.redraw(); });
  return { sc, glow };
});
let dateDone = false;
function checkDate() {
  if (dateDone || !discs.every((d) => d.sc.revealed)) return;
  dateDone = true;
  $('[data-reveal="date"]').disabled = true;
  gsap.to(discs.map((d) => d.glow), { opacity: 1, duration: 0.6, delay: 0.2, yoyo: true, repeat: 1, repeatDelay: 0.6, ease: 'sine.inOut' });
  if (!calm) {
    const p = boxPoint(s3.box, 50, 58);
    setTimeout(() => burst(s3.box, p.x, p.y, { count: 30, spread: s3.box.clientWidth * 0.32, kinds: ['pearl', 'petal', 'spark', 'ivory', 'spark'] }), 250);
  }
  vibrate([20, 40, 30]);
}
$('[data-reveal="date"]').addEventListener('click', () => discs.forEach((d, i) => setTimeout(() => d.sc.reveal({ quiet: true }), i * 180)));

// ── Page 4: scratch the photo ────────────────────────────────────────────────
const s4 = sections.find((s) => s.key === 'um4');
const ovalWrap = document.createElement('div');
ovalWrap.className = 'scratch scratch--oval';
{
  const pad = 3 / 1254 * 100; // ~3px under the frame lip
  const rx = OVAL.rx + pad, ry = OVAL.ry + pad;
  ovalWrap.style.cssText = `left:${OVAL.cx - rx}%;top:${OVAL.cy - ry}%;width:${2 * rx}%;height:${2 * ry}%`;
}
ovalWrap.setAttribute('aria-hidden', 'true');
const ovalGlow = Object.assign(document.createElement('div'), { className: 'frame-glow' });
ovalGlow.style.cssText = `left:${OVAL.cx - 19.4}%;top:${OVAL.cy - 26.2}%;width:38.8%;height:52.4%`;
s4.box.append(ovalGlow, ovalWrap);

let pearlTex = null;
function buildPearlTexture(imgs) {
  // mother-of-pearl built from the UM_3 discs, scaled up, rotated and feathered together
  const S = 512;
  const c = document.createElement('canvas'); c.width = S; c.height = Math.round(S * 1.37);
  const x = c.getContext('2d');
  const base = x.createLinearGradient(0, 0, S, c.height);
  base.addColorStop(0, '#f3ece6'); base.addColorStop(0.5, '#ece4ea'); base.addColorStop(1, '#f6eee2');
  x.fillStyle = base; x.fillRect(0, 0, S, c.height);
  const spots = [[0.3, 0.25, 0.9, 0.4], [0.75, 0.45, 0.85, 2.2], [0.35, 0.78, 0.95, 4.1], [0.8, 0.9, 0.7, 5.3], [0.15, 0.55, 0.6, 1.2]];
  spots.forEach(([px, py, sc, rot], k) => {
    const im = imgs[k % imgs.length];
    if (!im) return;
    const d = S * sc;
    const t = document.createElement('canvas'); t.width = t.height = Math.round(d);
    const tx = t.getContext('2d');
    tx.drawImage(im, 0, 0, d, d);
    tx.globalCompositeOperation = 'destination-in';
    const fg = tx.createRadialGradient(d / 2, d / 2, d * 0.18, d / 2, d / 2, d / 2);
    fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    tx.fillStyle = fg; tx.fillRect(0, 0, d, d);
    x.save();
    x.globalAlpha = 0.85;
    x.translate(px * S, py * c.height); x.rotate(rot);
    x.drawImage(t, -d / 2, -d / 2);
    x.restore();
  });
  // soft iridescent wash
  x.globalCompositeOperation = 'soft-light';
  const ir = x.createLinearGradient(0, 0, S, c.height);
  ir.addColorStop(0, 'rgba(190,225,255,.55)'); ir.addColorStop(0.35, 'rgba(255,210,235,.5)');
  ir.addColorStop(0.65, 'rgba(255,245,205,.5)'); ir.addColorStop(1, 'rgba(200,255,230,.45)');
  x.fillStyle = ir; x.fillRect(0, 0, S, c.height);
  return c;
}
function sparklePath(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.14, cy - r * 0.14, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.14, cy + r * 0.14, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.14, cy + r * 0.14, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.14, cy - r * 0.14, cx, cy - r);
  ctx.closePath();
}
const photo = new Scratch(ovalWrap, {
  shape: 'ellipse', threshold: 0.54, brush: 0.12, lenis,
  draw(ctx, w, h) {
    if (pearlTex) ctx.drawImage(pearlTex, 0, 0, w, h);
    else { ctx.fillStyle = '#efe7e4'; ctx.fillRect(0, 0, w, h); }
    // feathered inner shadow along the oval edge
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(1, h / w);
    const g = ctx.createRadialGradient(0, 0, w * 0.36, 0, 0, w * 0.5);
    g.addColorStop(0, 'rgba(90,60,20,0)'); g.addColorStop(0.75, 'rgba(90,60,20,.10)'); g.addColorStop(1, 'rgba(90,60,20,.38)');
    ctx.fillStyle = g; ctx.fillRect(-w, -w, 2 * w, 2 * w);
    ctx.restore();
    // words + sparkle, painted onto the cover so they scratch away too
    const fs = w * 0.105;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 500 ${fs}px "Cormorant Garamond", Georgia, serif`;
    ctx.shadowColor = 'rgba(255,255,255,.85)'; ctx.shadowBlur = fs * 0.25;
    ctx.fillStyle = 'rgba(70, 78, 36, .9)';
    ctx.fillText('Scratch to reveal', w / 2, h * 0.53);
    ctx.shadowBlur = fs * 0.4; ctx.shadowColor = 'rgba(255,240,200,.9)';
    ctx.fillStyle = 'rgba(184,145,75,.95)';
    sparklePath(ctx, w / 2, h * 0.43, fs * 0.42); ctx.fill();
    sparklePath(ctx, w / 2 + fs * 0.55, h * 0.405, fs * 0.17); ctx.fill();
    ctx.restore();
  },
  onReveal: (o) => {
    gsap.to(photo.canvas, { opacity: 0, scale: 1.05, duration: 0.9, ease: 'power2.out' });
    gsap.to(ovalGlow, { opacity: 1, duration: 0.7, yoyo: true, repeat: 1, repeatDelay: 0.5, ease: 'sine.inOut' });
    $('[data-reveal="photo"]').disabled = true;
    if (!calm) {
      const W = s4.box.clientWidth, H = s4.box.clientHeight;
      rise(s4.box, { x: (OVAL.cx - OVAL.rx) / 100 * W, y: (OVAL.cy - OVAL.ry) / 100 * H, w: OVAL.rx * 2 / 100 * W, h: OVAL.ry * 2 / 100 * H }, 9);
    }
    if (!o.quiet) vibrate(30);
  },
});
discsReady.then((imgs) => {
  pearlTex = buildPearlTexture(imgs.filter(Boolean));
  (document.fonts ? document.fonts.load('italic 500 40px "Cormorant Garamond"') : Promise.resolve()).finally(() => photo.redraw());
});
$('[data-reveal="photo"]').addEventListener('click', () => photo.reveal({ quiet: true }));
debug.scratch = { discs: discs.map((d) => d.sc), photo };

// ── Page 5: calendar + map ────────────────────────────────────────────────────
$('#map-btn').href = MAP_URL;
$('#gcal-link').href = googleCalendarUrl();
$('#ics-link').href = ICS_PATH;
const sheet = $('#cal-sheet');
const panel = $('.sheet__panel', sheet);
let lastFocus = null;
function openSheet() {
  lastFocus = document.activeElement;
  sheet.hidden = false;
  lenis && lenis.stop();
  gsap.fromTo($('.sheet__scrim', sheet), { opacity: 0 }, { opacity: 1, duration: 0.3 });
  gsap.fromTo(panel, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
  $('#gcal-link').focus();
}
function closeSheet() {
  if (sheet.hidden) return;
  gsap.to(panel, { y: 30, opacity: 0, duration: 0.25, ease: 'power2.in' });
  gsap.to($('.sheet__scrim', sheet), { opacity: 0, duration: 0.25, onComplete: () => { sheet.hidden = true; lenis && lenis.start(); lastFocus && lastFocus.focus(); } });
}
$('#cal-btn').addEventListener('click', openSheet);
$$('[data-close]', sheet).forEach((b) => b.addEventListener('click', closeSheet));
sheet.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
  if (e.key === 'Tab') {
    const f = $$('a, button', panel);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
$$('a', panel).forEach((a) => a.addEventListener('click', () => setTimeout(closeSheet, 400)));

// keep ScrollTrigger in sync once lazy images settle
window.addEventListener('load', () => ScrollTrigger.refresh());
