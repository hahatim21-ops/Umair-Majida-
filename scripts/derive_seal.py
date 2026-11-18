"""One-off helper: cut the wax seal out of UM_1.

Outputs (assets/derived/):
  seal.png         RGBA cut-out of the seal (600x600 crop around its centre), used for the favicons
Run:  python scripts/derive_seal.py
"""
from PIL import Image
import numpy as np, cv2, json
from scipy import ndimage as nd

SRC = 'assets/UM_1.JPEG.JPEG'
CX, CY, R = 555, 1911, 300  # seal centre in source px (2160x3840)

img = Image.open(SRC).convert('RGB')
x = np.asarray(img).astype(float)
c = x[CY - R:CY + R, CX - R:CX + R]
L = c.mean(2)
m = nd.uniform_filter(L, 9); m2 = nd.uniform_filter(L * L, 9)
sd = np.sqrt(np.maximum(m2 - m * m, 0))
seal = (sd < 9) & (L > 150)
seal = nd.binary_opening(seal, iterations=2)
lab, n = nd.label(seal)
k = np.argmax(nd.sum(seal, lab, range(1, n + 1))) + 1
s = nd.binary_fill_holes(nd.binary_closing(lab == k, iterations=6))
s = nd.binary_opening(s, iterations=4)

yy, xx = np.mgrid[0:2 * R, 0:2 * R]
rr = np.hypot(xx - R, yy - R)
ang = np.degrees(np.arctan2(yy - R, xx - R))
# the smooth lace fabric at the lower right leaks into the segmentation: clamp it
leak = (ang > -2) & (ang < 72) & (rr > 238)
s &= ~leak
s |= rr < 232          # shadowed rim on the lower left is part of the seal
s &= rr < 262
s = nd.binary_closing(s, iterations=3)
s = nd.binary_fill_holes(s)

alpha = nd.gaussian_filter(s.astype(float), 1.2)
rgba = np.dstack([c, alpha * 255]).clip(0, 255).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save('assets/derived/seal.png')

json.dump({'cx': CX, 'cy': CY, 'crop': 2 * R, 'w': 2160, 'h': 3840}, open('assets/derived/seal.json', 'w'))
print('ok')
