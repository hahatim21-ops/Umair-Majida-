"""One-off helper: find the painted pearls on the velvet strands of UM_1 and make a
patch (RGBA, 1080w) that paints velvet over those pearls.

Outputs:
  src/data/pearls.json             pearl centres + diameters (% of image width/height)
  assets/derived/UM_1_pearlpatch.png just the filled strand areas, with alpha
Run:  python scripts/derive_pearls.py
"""
import cv2, json, numpy as np
from scipy.spatial import cKDTree

SRC = 'assets/UM_1.JPEG.JPEG'
img = cv2.imread(SRC)
H, W = img.shape[:2]
g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)


def tmpl(d):
    s = int(d * 1.5) | 1; c = s / 2
    y, x = np.mgrid[0:s, 0:s]; r = np.hypot(x - c, y - c) / (d / 2)
    t = np.where(r < 1, 0.75 + 0.25 * np.clip(1 - np.hypot(x - c + d * .15, y - c + d * .15) / (d / 2), 0, 1), 0.0)
    return cv2.GaussianBlur(t.astype(np.float32), (0, 0), d * 0.06)


best = None
for d in (24, 28, 32, 36, 40, 44, 50):
    t = tmpl(d)
    res = cv2.matchTemplate(g, t, cv2.TM_CCOEFF_NORMED); pad = t.shape[0] // 2
    res = np.pad(res, ((pad, t.shape[0] - 1 - pad), (pad, t.shape[1] - 1 - pad)), constant_values=-1)
    if best is None: best = res; bd = np.full(res.shape, d, np.float32)
    else: m = res > best; best[m] = res[m]; bd[m] = d
mx = cv2.dilate(best, np.ones((19, 19), np.uint8))
ys, xs = np.nonzero((best == mx) & (best > 0.5))

b, gg, r = [img[..., i].astype(np.float32) for i in range(3)]
velvet = ((gg - b) > 12) & (g < 140)          # olive velvet pixels
P = []
for x, y in zip(xs, ys):
    d = bd[y, x]; rr = int(d * 0.3)
    core = g[max(0, y - rr):y + rr + 1, max(0, x - rr):x + rr + 1].mean()
    R = int(d * 1.05)
    win = velvet[max(0, y - R):y + R + 1, max(0, x - R):x + R + 1]
    yy, xx = np.mgrid[-R:R + 1, -R:R + 1][:, :win.shape[0], :win.shape[1]]
    ring = (np.hypot(xx, yy) > d * 0.62) & (np.hypot(xx, yy) < d * 1.05)
    if core > 150 and win[ring].mean() > 0.35:
        P.append((x, y, d, best[y, x]))
P = np.array(P, float)
for _ in range(3):  # chain filter
    tr = cKDTree(P[:, :2]); keep = []
    for i, (x, y, d, s) in enumerate(P):
        nb = [j for j in tr.query_ball_point((x, y), d * 1.55) if j != i and np.hypot(P[j, 0] - x, P[j, 1] - y) > d * 0.6]
        keep.append(len(nb) >= 2 or (len(nb) >= 1 and s > 0.75))
    P = P[np.array(keep)]

mask = np.zeros((H, W), np.uint8)
for x, y, d, s in P:
    cv2.circle(mask, (int(x + d * 0.06), int(y + d * 0.12)), int(d * 0.8), 255, -1)
# the thread between pearls
tr = cKDTree(P[:, :2])
for i, (x, y, d, s) in enumerate(P):
    for j in tr.query_ball_point((x, y), d * 1.6):
        if j > i: cv2.line(mask, (int(x), int(y)), (int(P[j, 0]), int(P[j, 1])), 255, max(4, int(d * 0.45)))
mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
# Directional fill: velvet folds run vertically, so interpolate each masked pixel along
# whichever of its vertical / horizontal masked spans is shorter (plain inpainting smears
# dark trails across the folds).
m = mask > 0
src = cv2.GaussianBlur(img, (0, 0), 1.2).astype(np.float32)


def spans(mm):
    """for each row of mm: start/end of the masked run each pixel belongs to"""
    h, w = mm.shape
    st = np.full((h, w), -1, np.int32); en = np.full((h, w), -1, np.int32)
    for yy in range(h):
        row = mm[yy]
        if not row.any(): continue
        d = np.diff(np.r_[0, row.astype(np.int8), 0])
        for a, b in zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]):
            st[yy, a:b] = a; en[yy, a:b] = b
    return st, en


hs, he = spans(m)
vs, ve = spans(m.T); vs, ve = vs.T, ve.T
out = img.astype(np.float32).copy()
ys2, xs2 = np.nonzero(m)
for y, x in zip(ys2, xs2):
    hl = he[y, x] - hs[y, x]; vl = ve[y, x] - vs[y, x]
    if vl <= 3 * hl:   # vertical unless the run is a near-vertical strand
        a, b = vs[y, x] - 1, ve[y, x]
        if a >= 0 and b < H:
            t = (y - a) / (b - a); out[y, x] = src[a, x] * (1 - t) + src[b, x] * t; continue
    a, b = hs[y, x] - 1, he[y, x]
    if a >= 0 and b < W:
        t = (x - a) / (b - a); out[y, x] = src[y, a] * (1 - t) + src[y, b] * t
# smooth along the folds (vertical) to remove any steps
ys_ = cv2.GaussianBlur(out, (0, 0), sigmaX=1.2, sigmaY=9)
out[m] = ys_[m]
# a touch of grain so the fill matches the velvet
noise = np.random.default_rng(1).normal(0, 2.2, out.shape).astype(np.float32)
out[m] += noise[m]
soft = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.5)[..., None]
out = (img * (1 - soft) + out * soft).clip(0, 255).astype(np.uint8)
# RGBA patch: only the filled strand areas (the page lays this over the gate at the tap)
alpha = (cv2.GaussianBlur((mask > 0).astype(np.float32), (0, 0), 2.0) * 255).clip(0, 255).astype(np.uint8)
alpha = cv2.dilate(alpha, np.ones((3, 3), np.uint8))
rgba = np.dstack([out, alpha]); rgba[alpha == 0] = 0
rgba = cv2.resize(rgba, (1080, 1920), interpolation=cv2.INTER_AREA)
cv2.imwrite('assets/derived/UM_1_pearlpatch.png', rgba, [cv2.IMWRITE_PNG_COMPRESSION, 9])
json.dump({'note': 'Painted pearls on the velvet strands of UM_1: x, y = centre (% of width/height), d = diameter (% of width).',
           'pearls': [{'x': round(x / W * 100, 3), 'y': round(y / H * 100, 3), 'd': round(d * 1.08 / W * 100, 3)} for x, y, d, s in P]},
          open('src/data/pearls.json', 'w'), indent=0)
print('pearls', len(P))
