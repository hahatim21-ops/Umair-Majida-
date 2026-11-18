// Minimal WebGL displacement "sway" for a flat card image.
// A greyscale mask (white = may move, black = frozen) limits the effect so text,
// frames, the seal, the photo and candles never warp.
import { dpr, runtime } from './env.js';

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Wind = two slow sines (periods 5.3s / 6.7s) + drifting value noise.
// Horizontal swing dominates (pendulum-like); the mask's vertical gradients make
// the lower ends of strands and drapes swing more than their anchors.
const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uImg;
uniform sampler2D uMask;
uniform float uTime;
uniform vec2 uAmp;
uniform float uDraw;   // 0 = curtain hanging, 1 = fully drawn to the right edge
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 uv = vUv;
  float shade = 1.0;
  float alpha = 1.0;
  if (uDraw > 0.0) {
    // the whole curtain gathers toward the right edge, bunching into folds
    float L = uDraw * 1.03;                       // leading (left) edge of the fabric
    float edgeWave = 0.018 * uDraw * sin(vUv.y * 9.0 + uTime * 2.0); // hem ripples
    float x = vUv.x - edgeWave;
    alpha = smoothstep(L - 0.012, L + 0.012, x);
    if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }
    float u = clamp((x - L) / max(1.0 - L, 0.0001), 0.0, 1.0);
    float k = 5.0 + 9.0 * uDraw;                  // more folds as it bunches up
    float ph = u * k * 6.2831;
    uv.x = clamp(u + (0.010 + 0.02 * uDraw) * sin(ph) / k * 4.0, 0.0, 1.0);
    uv.y = vUv.y + 0.012 * uDraw * vUv.y * sin(ph * 0.5 + 1.3);
    float fold = 0.5 + 0.5 * cos(ph);
    shade = 1.0 - (0.18 + 0.36 * uDraw) * min(1.0, uDraw * 1.6) * fold * fold;
    shade *= mix(0.72, 1.0, smoothstep(0.0, 0.08, u));       // shadow along the leading edge
    shade += 0.10 * uDraw * pow(1.0 - fold, 6.0);            // sheen on fold ridges
  }
  float m = texture2D(uMask, uv).r;
  vec2 off = vec2(0.0);
  if (m > 0.004) {
    float t = uTime;
    float w1 = sin(t * 1.1855 + uv.y * 3.1 + uv.x * 1.3);          // 5.3 s
    float w2 = sin(t * 0.9378 + uv.y * 5.0 - uv.x * 2.1 + 1.7);    // 6.7 s
    float w3 = sin(t * 1.3659 + uv.x * 4.0 + uv.y * 0.7);          // 4.6 s
    float n = noise(vec2(uv.x * 3.0 + t * 0.17, uv.y * 3.0 - t * 0.11)) * 2.0 - 1.0;
    off.x = 0.55 * w1 + 0.30 * w2 + 0.30 * n;
    off.y = 0.22 * w3 + 0.18 * n;
    off *= uAmp * m;
  }
  vec4 c = texture2D(uImg, uv + off);
  gl_FragColor = vec4(c.rgb * shade, alpha);
}`;

const instances = new Set();

// frame monitor: if the device can't hold ~40fps while swaying, switch sway off
let frames = [], lastT = 0, slow = 0;
function monitor(now) {
  if (lastT) frames.push(now - lastT);
  lastT = now;
  if (frames.length >= 120) {
    const sorted = frames.slice().sort((a, b) => a - b);
    const median = sorted[60];
    frames = [];
    slow = median > 25 ? slow + 1 : 0;
    if (slow >= 2) {               // two slow windows in a row (~4s below 40fps)
      runtime.swayDisabled = true;
      instances.forEach((s) => { if (!s.keep) s.dispose(); });
    }
  }
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

export class Sway {
  /**
   * @param {HTMLElement} host  element to put the canvas in (fills it)
   * @param {HTMLImageElement} img the card <img> (its currentSrc is used as texture)
   * @param {string} maskUrl
   * @param {object} opts { amp: px at mask=1 }
   */
  constructor(host, img, maskUrl, opts = {}) {
    this.host = host; this.img = img; this.maskUrl = maskUrl;
    this.amp = opts.amp ?? 5;
    this.active = false; this.ready = false; this.t0 = performance.now();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sway';
    this.canvas.setAttribute('aria-hidden', 'true');
    const after = opts.after || null;
    if (after && after.parentNode === host) after.after(this.canvas); else host.appendChild(this.canvas);
    instances.add(this);
    this._init().catch((e) => { console.warn('sway disabled', e); this.dispose(); });
  }

  async _init() {
    const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.dispose(); });

    if (!this.img.complete || !this.img.naturalWidth) await new Promise((r) => this.img.addEventListener('load', r, { once: true }));
    const [tex, mask] = await Promise.all([loadImage(this.img.currentSrc || this.img.src), loadImage(this.maskUrl)]);
    if (this.disposed) return;

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
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const mkTex = (unit, source) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      return t;
    };
    mkTex(0, tex);
    mkTex(1, mask);
    gl.uniform1i(gl.getUniformLocation(prog, 'uImg'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uMask'), 1);
    this.uTime = gl.getUniformLocation(prog, 'uTime');
    this.uAmp = gl.getUniformLocation(prog, 'uAmp');
    this.uDraw = gl.getUniformLocation(prog, 'uDraw');

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
    this.resize();
    this.ready = true;
    this.render(performance.now());
    this.canvas.classList.add('is-ready');
  }

  resize() {
    if (!this.gl) return;
    const r = this.host.getBoundingClientRect();
    this.cssW = r.width; this.cssH = r.height;
    // cap the backing store at ~1.6 MP to stay cheap on phones
    let scale = dpr;
    const px = r.width * r.height * scale * scale;
    if (px > 1.6e6) scale *= Math.sqrt(1.6e6 / px);
    const w = Math.max(1, Math.round(r.width * scale)), h = Math.max(1, Math.round(r.height * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
    if (!this.active && this.ready) this.render(performance.now());
  }

  render(now) {
    if (!this.ready || this.disposed) return;
    const gl = this.gl;
    const t = (now - this.t0) / 1000;
    gl.uniform1f(this.uTime, t);
    gl.uniform1f(this.uDraw, this.draw || 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // amplitude in UV units: `amp` CSS px at mask = 1 (peaks ~1.2x, i.e. ≤ 6px)
    gl.uniform2f(this.uAmp, this.amp / Math.max(1, this.cssW), this.amp / Math.max(1, this.cssH));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  tick(now) {
    if (this.active && this.ready) { this.render(now); return true; }
    return false;
  }

  setActive(on) {
    this.active = on && !runtime.swayDisabled;
    if (!on) lastT = 0;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.active = false;
    instances.delete(this);
    this.ro && this.ro.disconnect();
    this.canvas.classList.remove('is-ready');
    setTimeout(() => {
      const ext = this.gl && this.gl.getExtension('WEBGL_lose_context');
      ext && ext.loseContext();
      this.canvas.remove();
    }, 700);
  }
}

export function tickAll(now) {
  let any = false;
  instances.forEach((s) => { if (s.tick(now)) any = true; });
  if (any) monitor(now); else lastT = 0;
}
