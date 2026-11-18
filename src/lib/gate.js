// Page 1 – the gate.
// The whole card is shown (never zoomed). Tap the seal: a soft gold pulse, the pearl
// strands come loose and the pearls fall one by one, then the velvet curtain parts
// down the middle and gathers into both sides, revealing the invitation.
import { gsap } from 'gsap';
import { dpr } from './env.js';
import pearlData from '../data/pearls.json';

const SEAL = { x: 25.69, y: 49.77 };

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uImg;
uniform sampler2D uPlate;
uniform sampler2D uMask;
uniform sampler2D uBd;
uniform float uUsePlate;
uniform vec4 uRect;      // image rect inside the canvas (uv): x0, y0, x1, y1
uniform vec4 uFeather;   // top, bottom, left, right feather (image uv), 0 = none
uniform vec2 uBdScale;
uniform float uTime;
uniform vec2 uAmp;
uniform float uOpen;     // 0 closed … 1 fully parted
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 scene(vec2 q) {
  vec3 bd = texture2D(uBd, (q - 0.5) * uBdScale + 0.5).rgb * 0.84;
  vec2 iu = (q - uRect.xy) / (uRect.zw - uRect.xy);
  if (iu.x < 0.0 || iu.x > 1.0 || iu.y < 0.0 || iu.y > 1.0) return bd;
  float m = texture2D(uMask, iu).r;
  vec2 off = vec2(0.0);
  if (m > 0.004) {
    float t = uTime;
    float w1 = sin(t * 1.1855 + iu.y * 3.1 + iu.x * 1.3);
    float w2 = sin(t * 0.9378 + iu.y * 5.0 - iu.x * 2.1 + 1.7);
    float w3 = sin(t * 1.3659 + iu.x * 4.0 + iu.y * 0.7);
    float n = noise(vec2(iu.x * 3.0 + t * 0.17, iu.y * 3.0 - t * 0.11)) * 2.0 - 1.0;
    off = vec2(0.55 * w1 + 0.30 * w2 + 0.30 * n, 0.22 * w3 + 0.18 * n) * uAmp * m;
  }
  vec2 su = clamp(iu + off, 0.0, 1.0);
  vec3 c = mix(texture2D(uImg, su).rgb, texture2D(uPlate, su).rgb, uUsePlate);
  float f = 1.0;
  if (uFeather.x > 0.0) f *= smoothstep(0.0, uFeather.x, iu.y);
  if (uFeather.y > 0.0) f *= smoothstep(0.0, uFeather.y, 1.0 - iu.y);
  if (uFeather.z > 0.0) f *= smoothstep(0.0, uFeather.z, iu.x);
  if (uFeather.w > 0.0) f *= smoothstep(0.0, uFeather.w, 1.0 - iu.x);
  return mix(bd, c, f);
}
void main() {
  vec2 q = vUv;
  float shade = 1.0;
  float alpha = 1.0;
  if (uOpen > 0.0) {
    float p = uOpen;
    float e = 0.5 * (1.0 - p);                           // leading edge of each curtain
    bool left = vUv.x < 0.5;
    float d = left ? vUv.x : 1.0 - vUv.x;                 // distance from the outer edge
    d -= 0.010 * p * sin(vUv.y * 7.0 + uTime * 2.0);      // the leading edge ripples
    alpha = 1.0 - smoothstep(e - 0.004, e + 0.004, d);
    float t = clamp(d / max(e, 0.0001), 0.0, 1.0);        // 0 outer edge … 1 leading edge
    float k = 4.0 + 10.0 * p;                             // more folds as it gathers
    float ph = t * k * 6.2831;
    float tt = clamp(t + 0.16 * p * sin(ph) / k * 3.0, 0.0, 1.0);
    q.x = left ? 0.5 * tt : 1.0 - 0.5 * tt;
    float lift = 0.08 * p * t * t;                        // the hem lifts at the leading edge
    q.y = vUv.y / (1.0 - lift);
    alpha *= 1.0 - smoothstep(0.996, 1.004, q.y);
    float fold = 0.5 + 0.5 * cos(ph);
    shade = 1.0 - (0.14 + 0.34 * p) * min(1.0, p * 1.8) * fold * fold;
    shade *= mix(1.0, 0.72, smoothstep(0.86, 1.0, t) * min(1.0, p * 4.0));
    shade += 0.07 * p * pow(1.0 - fold, 6.0);
  }
  if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }
  gl_FragColor = vec4(scene(clamp(q, 0.0, 1.0)) * shade, alpha);
}`;

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

class GateGL {
  constructor(col, box, sources) {
    this.col = col; this.box = box;
    this.open = 0; this.amp = 5; this.usePlate = 0; this.t0 = performance.now();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'gate__gl';
    this.canvas.setAttribute('aria-hidden', 'true');
    col.insertBefore(this.canvas, box);
    const gl = (this.gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false }));
    if (!gl) throw new Error('no webgl');
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['uImg', 'uPlate', 'uMask', 'uBd', 'uUsePlate', 'uRect', 'uFeather', 'uBdScale', 'uTime', 'uAmp', 'uOpen']) this.u[n] = gl.getUniformLocation(prog, n);
    this.tex(0, sources.img); this.tex(1, sources.img); this.tex(2, sources.mask); this.tex(3, sources.bd);
    gl.uniform1i(this.u.uImg, 0); gl.uniform1i(this.u.uPlate, 1); gl.uniform1i(this.u.uMask, 2); gl.uniform1i(this.u.uBd, 3);
    this.bdAspect = sources.bd.width / sources.bd.height;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(col);
    this.resize();
    this.tick = () => this.render();
    gsap.ticker.add(this.tick);
  }

  tex(unit, source) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  setPlate(canvas) { this.tex(1, canvas); this.hasPlate = true; }

  resize() {
    const gl = this.gl;
    const c = this.col.getBoundingClientRect();
    const b = this.box.getBoundingClientRect();
    this.W = c.width; this.H = c.height;
    let s = dpr;
    if (c.width * c.height * s * s > 2.4e6) s = Math.sqrt(2.4e6 / (c.width * c.height));
    const w = Math.max(1, Math.round(c.width * s)), h = Math.max(1, Math.round(c.height * s));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; gl.viewport(0, 0, w, h); }
    const x0 = (b.left - c.left) / c.width, y0 = (b.top - c.top) / c.height;
    const x1 = (b.right - c.left) / c.width, y1 = (b.bottom - c.top) / c.height;
    gl.uniform4f(this.u.uRect, x0, y0, x1, y1);
    // feather only the edges that meet a backdrop band (in image uv, ~24px)
    gl.uniform4f(this.u.uFeather,
      y0 > 0.002 ? 24 / b.height : 0, y1 < 0.998 ? 24 / b.height : 0,
      x0 > 0.002 ? 18 / b.width : 0, x1 < 0.998 ? 18 / b.width : 0);
    const A = c.width / c.height, B = this.bdAspect;
    gl.uniform2f(this.u.uBdScale, (A > B ? 1 : A / B) * 0.9, (A > B ? B / A : 1) * 0.9);
    this.bw = b.width; this.bh = b.height;
  }

  render() {
    const gl = this.gl;
    gl.uniform1f(this.u.uTime, (performance.now() - this.t0) / 1000);
    gl.uniform2f(this.u.uAmp, this.amp / Math.max(1, this.bw), this.amp / Math.max(1, this.bh));
    gl.uniform1f(this.u.uOpen, this.open);
    gl.uniform1f(this.u.uUsePlate, this.usePlate);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    gsap.ticker.remove(this.tick);
    this.ro.disconnect();
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext && ext.loseContext();
  }
}

// gate image with the pearl strands painted over in velvet (patch is a small RGBA webp)
async function buildPlate(img) {
  const patch = await loadImage('/assets/img/um1-pearlpatch.webp');
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.drawImage(patch, 0, 0, c.width, c.height);
  return c;
}

export function initGate({ music, calm, onOpenStart, onOpened }) {
  const gate = document.getElementById('gate');
  const col = gate.querySelector('.gate__col');
  const box = gate.querySelector('.gate__box');
  const img = document.getElementById('gate-img');
  const btn = document.getElementById('seal-btn');
  const hint = document.getElementById('gate-hint');
  const ring = gate.querySelector('.seal-ring');

  const burst = Object.assign(document.createElement('div'), { className: 'seal-burst' });
  const glow = Object.assign(document.createElement('div'), { className: 'seal-glow' });
  burst.setAttribute('aria-hidden', 'true');
  glow.setAttribute('aria-hidden', 'true');
  box.append(glow, burst);

  // hint: letters drift in one by one
  const words = hint.textContent.trim().split(' ');
  hint.innerHTML = words.map((w) => `<span class="hint-w">${[...w].map((ch) => `<span class="hint-l">${ch}</span>`).join('')}</span>`).join(' ');
  const letters = hint.querySelectorAll('.hint-l');

  let gl = null, plate = null, sprites = [];

  const ready = async () => {
    gsap.set(hint, { opacity: 1 });
    gsap.fromTo(letters, { opacity: 0, y: 6, filter: 'blur(3px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.045, delay: 1, ease: 'sine.out' });
    if (calm) return;
    try {
      const [mask, bd] = await Promise.all([loadImage('/assets/masks/UM_1.png'), loadImage('/assets/img/um1-bd.jpg')]);
      gl = new GateGL(col, box, { img, mask, bd });
      gl.render();
      col.classList.add('has-gl');
    } catch (e) {
      console.warn('gate webgl unavailable', e);
      gl = null;
    }
    try {
      plate = await buildPlate(img);
      if (gl) gl.setPlate(plate);
      makeSprites();
    } catch (e) { console.warn('pearl plate unavailable', e); plate = null; }
  };

  // one sprite per painted pearl, cut from the gate image itself
  function makeSprites() {
    const src = img.currentSrc || img.src;
    const layer = document.createElement('div');
    layer.className = 'pearl-fall';
    layer.setAttribute('aria-hidden', 'true');
    sprites = pearlData.pearls.map((p) => {
      const el = document.createElement('span');
      el.className = 'pearl-sprite';
      const dW = p.d;              // % of box width
      const h = p.d * (9 / 16);    // same size in % of box height (box is 9:16)
      const x0 = p.x - dW / 2, y0 = p.y - h / 2;
      el.style.cssText = `left:${x0}%;top:${y0}%;width:${dW}%;height:${h}%;` +
        `background-image:url("${src}");background-size:${(100 / dW) * 100}% ${(100 / h) * 100}%;` +
        `background-position:${(x0 / (100 - dW)) * 100}% ${(y0 / (100 - h)) * 100}%`;
      layer.appendChild(el);
      return { el, p };
    });
    box.appendChild(layer);
    // the hint and seal UI stay above the falling pearls
    box.appendChild(hint);
  }

  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    btn.disabled = true;
    music.start();                       // inside the tap: browsers allow audio now
    onOpenStart && onOpenStart();

    const ringOpacity = getComputedStyle(ring).opacity;
    ring.style.animation = 'none';       // stop the CSS breathing loop so it can fade

    const tl = gsap.timeline({ onComplete: finish });
    // 1. the seal answers the tap
    tl.fromTo(ring, { opacity: ringOpacity }, { opacity: 0, duration: 0.35 }, 0)
      .to(hint, { opacity: 0, duration: 0.4 }, 0)
      .fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'sine.out' }, 0)
      .to(glow, { opacity: 0, scale: 1.3, duration: 0.9, ease: 'sine.in' }, 0.35)
      .fromTo(burst, { opacity: 1, scale: 0.95 }, { opacity: 0, scale: 2.1, duration: 1.0, ease: 'power2.out' }, 0.05);

    if (calm) {
      // reduced motion: the curtain simply parts, no falling pearls
      tl.add(() => onOpened && onOpened('reveal'), 0.3);
      domPart(tl, 0.3, 1.1);
      return;
    }

    // 2. the strands come loose: pearls fall, cascading out from the seal
    let T = 0.35;
    const havePearls = plate && sprites.length;
    if (havePearls) {
      if (gl) {
        const a = { v: gl.amp };
        tl.to(a, { v: 0, duration: 0.25, onUpdate: () => (gl.amp = a.v) }, 0);   // hold still for the swap
        tl.add(() => { gl.usePlate = 1; box.querySelector('.pearl-fall').classList.add('is-on'); }, 0.26);
      } else {
        tl.add(() => {
          const c = plate; c.className = 'card-img gate__plate';
          box.insertBefore(c, box.querySelector('picture').nextSibling);
          box.querySelector('.pearl-fall').classList.add('is-on');
        }, 0.26);
      }
      const colRect = col.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      let last = 0;
      sprites.forEach(({ el, p }) => {
        const dx = (p.x - SEAL.x) / 100, dy = ((p.y - SEAL.y) / 100) * (16 / 9);
        const dist = Math.hypot(dx, dy);
        const delay = 0.3 + dist * 0.75 + gsap.utils.random(0, 0.22);
        const yPx = boxRect.top - colRect.top + (p.y / 100) * boxRect.height;
        const fall = colRect.height - yPx + 40;
        const dur = 0.55 + Math.sqrt(fall / colRect.height) * 0.75;
        tl.to(el, { y: -gsap.utils.random(2, 6), duration: 0.12, ease: 'sine.out' }, delay)
          .to(el, {
            y: fall, x: gsap.utils.random(-18, 18), rotation: gsap.utils.random(-220, 220),
            duration: dur, ease: 'power2.in',
          }, delay + 0.12);
        last = Math.max(last, delay + 0.12 + dur);
      });
      T = Math.min(last - 0.5, 1.9);
    }

    // 3. the curtain parts down the middle and gathers to both sides
    tl.add(() => onOpened && onOpened('reveal'), T);
    tl.add(() => btn.remove(), T);
    if (gl) {
      tl.add(() => box.querySelector('picture').style.visibility = 'hidden', 0);
      const o = { p: 0 };
      tl.to(o, { p: 1, duration: 2.2, ease: 'power2.inOut', onUpdate: () => (gl.open = o.p) }, T);
    } else {
      domPart(tl, T, 2.0);
    }
  };

  // fallback (no WebGL / reduced motion): two halves slide apart
  function domPart(tl, at, dur) {
    tl.add(() => {
      const halves = ['l', 'r'].map((side) => {
        const h = col.cloneNode(true);
        h.classList.add('gate__half', `gate__half--${side}`);
        h.querySelectorAll('button, .gate__hint, .seal-ring, .seal-glow, .seal-burst, .pearl-fall, canvas').forEach((n) => n.remove());
        if (plate) {
          const c = plate.cloneNode(); c.getContext('2d').drawImage(plate, 0, 0);
          c.className = 'card-img gate__plate';
          h.querySelector('.gate__box').appendChild(c);
        }
        gate.appendChild(h);
        return h;
      });
      col.style.visibility = 'hidden';
      gsap.to(halves[0], { xPercent: -55, duration: dur, ease: 'power2.inOut' });
      gsap.to(halves[1], { xPercent: 55, duration: dur, ease: 'power2.inOut' });
    }, at);
    tl.to({}, { duration: dur }, at);
  }

  function finish() {
    gl && gl.dispose();
    gate.remove();
    onOpened && onOpened('done');
  }

  btn.addEventListener('click', open);
  return { ready, open, get gl() { return gl; } };
}
