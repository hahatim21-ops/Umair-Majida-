// Builds every optimised asset the site needs from the originals in /assets.
// The originals are never modified.   Run:  npm run assets
//
//  public/assets/img/      card images (AVIF / WebP / JPEG, ~1440w + 828w), backdrops,
//                          pearl discs cropped from UM_3, the seal cut-out, gate plate
//  public/assets/masks/    sway masks rendered from src/data/masks/*.json
//  public/assets/audio/    allahumma.mp3 (re-encoded copy of the original)
//  public/og.jpg, favicons
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = (p) => path.join(ROOT, 'assets', p);
const OUT = path.join(ROOT, 'public');
const IMG = path.join(OUT, 'assets/img');
const MASKS = path.join(OUT, 'assets/masks');
const AUDIO = path.join(OUT, 'assets/audio');
for (const d of [IMG, MASKS, AUDIO]) fs.mkdirSync(d, { recursive: true });

const SOURCES = {
  um1: A('UM_1.JPEG.JPEG'),
  um2: A('UM_2.JPEG.JPEG'),
  um2blank: A('derived/UM_2_blank.jpg'),
  um3blank: A('derived/UM_3_blank.jpg'),
  um5blank: A('derived/UM_5_blank.jpg'),
  um6blank: A('derived/UM_6_blank.jpg'),
  um3: A('UM_3.1.PNG.PNG'),
  um4: A('UM_4.PNG.PNG'),
  um5: A('UM_5.JPEG.JPEG'),
  um6: A('UM_6.JPEG.JPEG'),
};
// large width per image (never upscale; UM_3.1 keeps its full 1672px because phones zoom into it)
const LARGE = { um1: 1440, um2: 1440, um2blank: 1440, um3: 1672, um3blank: 1672, um5blank: 1080, um6blank: 1080, um4: 1254, um5: 1080, um6: 1080 };
const SMALL = 828;

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
const log = (f) => console.log('  ' + path.relative(ROOT, f).padEnd(44) + kb(f));

async function cardImages() {
  console.log('card images');
  for (const [key, src] of Object.entries(SOURCES)) {
    const meta = await sharp(src).metadata();
    for (const w of [LARGE[key], SMALL]) {
      const width = Math.min(w, meta.width);
      const base = sharp(src).resize({ width, withoutEnlargement: true });
      const name = `${key}-${w === SMALL ? 's' : 'l'}`;
      const avif = path.join(IMG, name + '.avif');
      const webp = path.join(IMG, name + '.webp');
      const jpg = path.join(IMG, name + '.jpg');
      await base.clone().avif({ quality: 52, effort: 6, chromaSubsampling: '4:2:0' }).toFile(avif);
      await base.clone().webp({ quality: 78, effort: 6 }).toFile(webp);
      await base.clone().jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(jpg);
      [avif, webp, jpg].forEach(log);
    }
    // backdrop: tiny, pre-blurred (~30px at display size), stretched with cover-fit in CSS
    if (!key.endsWith('blank')) {
      const bd = path.join(IMG, `${key}-bd.jpg`);
      let input = sharp(src);
      if (key === 'um4') {
        // hide the photo so the dark oval doesn't bleed into the backdrop before it's revealed
        const m = await sharp(src).metadata();
        const oval = Buffer.from(`<svg width="${m.width}" height="${m.height}"><ellipse cx="${0.4981 * m.width}" cy="${0.4651 * m.height}" rx="${0.205 * m.width}" ry="${0.272 * m.height}" fill="#efe4d3"/></svg>`);
        input = sharp(await sharp(src).composite([{ input: oval }]).toBuffer());
      }
      await input.resize({ width: 120 }).blur(3.2).modulate({ brightness: 0.95 }).jpeg({ quality: 70 }).toFile(bd);
      log(bd);
    }
  }
}

// Pearl discs from UM_3 (covered state). Centres/radii measured by fitting the inner gold ring.
const DISCS = [
  { cx: 502.8, cy: 556.0, r: 117.0 },
  { cx: 834.6, cy: 556.5, r: 116.9 },
  { cx: 1165.1, cy: 556.4, r: 116.3 },
];
async function discs() {
  console.log('pearl discs');
  for (const [i, d] of DISCS.entries()) {
    const r = Math.floor(d.r) + 1;
    const left = Math.round(d.cx - r), top = Math.round(d.cy - r);
    const f = path.join(IMG, `disc-${i + 1}.webp`);
    await sharp(SOURCES.um3.replace('UM_3.1.PNG.PNG', 'UM_3.PNG.PNG'))
      .extract({ left, top, width: r * 2, height: r * 2 })
      .resize(320, 320, { kernel: 'lanczos3' })
      .webp({ quality: 86 })
      .toFile(f);
    log(f);
  }
}

// Pearl-free patch for the gate (painted velvet over the strands that fall at the tap)
async function pearlPatch() {
  console.log('pearl patch');
  const f = path.join(IMG, 'um1-pearlpatch.webp');
  await sharp(A('derived/UM_1_pearlpatch.png')).resize({ width: 828 }).webp({ quality: 80, alphaQuality: 70, effort: 6 }).toFile(f);
  log(f);
}

async function ogAndIcons() {
  console.log('og + favicons');
  // 1200x630 from the seal area of UM_1 (seal centre 555,1911 in a 2160x3840 image)
  const cropW = 1500, cropH = Math.round(cropW * 630 / 1200);
  const left = 0, top = Math.round(1911 - cropH / 2);
  const og = path.join(OUT, 'og.jpg');
  const vignette = Buffer.from(
    `<svg width="1200" height="630"><defs><radialGradient id="g" cx="0.37" cy="0.5" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1d2410" stop-opacity="0.55"/>
    </radialGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`);
  await sharp(SOURCES.um1).extract({ left, top, width: cropW, height: cropH }).resize(1200, 630)
    .composite([{ input: vignette }]).jpeg({ quality: 84, mozjpeg: true }).toFile(og);
  log(og);
  const seal = A('derived/seal.png');
  // the seal crop has transparent corners; trim slightly so it fills the icon
  const icon = (size) => sharp(seal).extract({ left: 50, top: 50, width: 500, height: 500 }).resize(size, size);
  const items = [
    ['favicon-32.png', 32], ['favicon-192.png', 192], ['favicon-512.png', 512],
  ];
  for (const [name, s] of items) { const f = path.join(OUT, name); await icon(s).png({ palette: true, compressionLevel: 9 }).toFile(f); log(f); }
  // apple touch icon: opaque olive background
  const at = path.join(OUT, 'apple-touch-icon.png');
  const sealBuf = await icon(150).png().toBuffer();
  await sharp({ create: { width: 180, height: 180, channels: 4, background: '#55602f' } })
    .composite([{ input: sealBuf, left: 15, top: 15 }]).png().toFile(at);
  log(at);
}

function maskSvg(def) {
  const [aw, ah] = def.aspect;
  const W = def.outWidth, H = Math.round(W * ah / aw);
  const X = (v) => (v / 100) * W, Y = (v) => (v / 100) * H;
  const g = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  const grey = (v) => `rgb(${g(v)},${g(v)},${g(v)})`;
  let defs = '', body = '';
  def.shapes.forEach((s, i) => {
    let fill;
    if (s.grad) {
      defs += `<linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${grey(s.grad[0])}"/><stop offset="1" stop-color="${grey(s.grad[1])}"/></linearGradient>`;
      fill = `url(#g${i})`;
    } else fill = grey(s.v);
    if (s.rect) {
      const [x, y, w, h] = s.rect;
      body += `<rect x="${X(x)}" y="${Y(y)}" width="${X(w)}" height="${Y(h)}" fill="${fill}"/>`;
    } else if (s.ellipse) {
      const [cx, cy, rx, ry] = s.ellipse;
      body += `<ellipse cx="${X(cx)}" cy="${Y(cy)}" rx="${X(rx)}" ry="${Y(ry)}" fill="${fill}"/>`;
    } else if (s.poly) {
      const pts = s.poly.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
      body += `<polygon points="${pts}" fill="${fill}"/>`;
    }
  });
  const blur = (def.blur / 100) * W;
  return {
    W, H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>${defs}<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs>
      <rect width="${W}" height="${H}" fill="${grey(def.base)}"/>
      <g filter="url(#b)">${body}</g></svg>`,
  };
}

async function masks() {
  console.log('masks');
  const dir = path.join(ROOT, 'src/data/masks');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const def = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const { svg } = maskSvg(def);
    const out = path.join(MASKS, file.replace('.json', '.png'));
    await sharp(Buffer.from(svg)).toColourspace('b-w').png({ compressionLevel: 9, palette: true, colours: 64 }).toFile(out);
    log(out);
  }
}

function audio() {
  console.log('audio');
  const src = A('Allah_humma_audio.mpeg.mpeg');
  const out = path.join(AUDIO, 'allahumma.mp3');
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-map_metadata', '-1', '-vn',
      '-ac', '2', '-ar', '44100', '-b:a', '96k', out]);
  } catch {
    console.warn('  ffmpeg not found: copying the original mp3 unchanged');
    fs.copyFileSync(src, out);
  }
  log(out);
}

const only = process.argv[2];
const tasks = { cardImages, discs, pearlPatch, ogAndIcons, masks, audio };
for (const [name, fn] of Object.entries(tasks)) {
  if (!only || only === name) await fn();
}
