"""One-off helper: text-free copies of the cards whose text animates in line by line.

For every text line in src/data/lines.json, the strokes inside the (padded) line box
are found by colour distance from the local background and inpainted.
Outputs assets/derived/UM_2_blank.jpg, UM_3_blank.jpg, UM_5_blank.jpg, UM_6_blank.jpg
Run:  python scripts/derive_blanks.py [um3 um5 ...]
"""
import cv2, json, sys, numpy as np

CARDS = {
    'um2': ('assets/UM_2.JPEG.JPEG', 'assets/derived/UM_2_blank.jpg'),
    'um3': ('assets/UM_3.1.PNG.PNG', 'assets/derived/UM_3_blank.jpg'),
    'um5': ('assets/UM_5.JPEG.JPEG', 'assets/derived/UM_5_blank.jpg'),
    'um6': ('assets/UM_6.JPEG.JPEG', 'assets/derived/UM_6_blank.jpg'),
}
LINES = json.load(open('src/data/lines.json', encoding='utf8'))
PADX, PADY = 0.6, 0.25  # % padding around each line box (same as src/lib/lines.js)

for key in (sys.argv[1:] or CARDS):
    src_p, out_p = CARDS[key]
    img = cv2.imread(src_p)
    H, W = img.shape[:2]
    zone = np.zeros((H, W), np.uint8)
    for ln in LINES[key]:
        x, y, w, h = ln['box']
        x0 = int((x - PADX) / 100 * W); x1 = int((x + w + PADX) / 100 * W)
        y0 = int((y - PADY) / 100 * H); y1 = int((y + h + PADY) / 100 * H)
        zone[max(0, y0):y1, max(0, x0):x1] = 1
    out = img.copy()
    for k, (thr, grow, ks) in enumerate(((10, 4, 61), (7, 6, 81))):
        lab = cv2.cvtColor(out, cv2.COLOR_BGR2LAB)
        bg = cv2.medianBlur(lab, ks).astype(np.float32)
        diff = np.sqrt(((lab.astype(np.float32) - bg) ** 2).sum(2))
        m = ((diff > thr) & (zone > 0)).astype(np.uint8)
        m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=grow) * zone
        out = cv2.inpaint(out, m * 255, 9, cv2.INPAINT_TELEA)
    # soften the filled areas a touch so they match the paper grain
    blur = cv2.GaussianBlur(out, (0, 0), 1.0)
    z = (cv2.GaussianBlur(zone.astype(np.float32), (0, 0), 3) * zone)[..., None]
    out = (out * (1 - z * 0.5) + blur * (z * 0.5)).astype(np.uint8)
    cv2.imwrite(out_p, out, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print('wrote', out_p)
