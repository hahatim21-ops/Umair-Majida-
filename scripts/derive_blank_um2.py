"""One-off helper: make a text-free copy of UM_2 for the write-in effect.
Text strokes are found inside the text boxes (in %) by colour distance from the
local background, then inpainted.  Output: assets/derived/UM_2_blank.jpg
Run:  python scripts/derive_blank_um2.py
"""
import cv2, numpy as np
from scipy import ndimage as nd
src = cv2.imread('assets/UM_2.JPEG.JPEG')
H, W = src.shape[:2]
# text zones (x, y, w, h in %) - same boxes as the black areas of src/data/masks/UM_2.json
boxes = [(27, 14, 46, 12.5), (17, 25.5, 66, 9), (12.5, 33, 75, 13.5), (8.5, 44.5, 85, 21.5),
         (38, 65, 24, 6), (36, 73, 28, 4)]
lab = cv2.cvtColor(src, cv2.COLOR_BGR2LAB).astype(float)
bg = np.dstack([nd.median_filter(lab[..., c], size=41) for c in range(3)])
diff = np.sqrt(((lab - bg) ** 2).sum(2))
zone = np.zeros((H, W), bool)
for x, y, w, h in boxes:
    zone[int(y / 100 * H):int((y + h) / 100 * H), int(x / 100 * W):int((x + w) / 100 * W)] = True
# keep curtains/lace out of the text mask: only paper-coloured surroundings count
paper = (bg[..., 0] > 205)
mask = (diff > 9) & zone & paper
mask = nd.binary_dilation(mask, iterations=4)
out = cv2.inpaint(src, mask.astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)
cv2.imwrite('assets/derived/UM_2_blank.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 92])
print('masked px', int(mask.sum()))

# second pass: catch thick strokes / dots that survived (fast median on the cleaned image)
out = cv2.imread('assets/derived/UM_2_blank.jpg')
lab2 = cv2.cvtColor(out, cv2.COLOR_BGR2LAB)
bg2 = cv2.medianBlur(lab2, 61).astype(float)
d2 = np.sqrt(((lab2.astype(float) - bg2) ** 2).sum(2))
m2 = (d2 > 7) & zone & (bg2[..., 0] > 200)
m2 = nd.binary_dilation(m2, iterations=6)
out2 = cv2.inpaint(out, m2.astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA)
cv2.imwrite('assets/derived/UM_2_blank.jpg', out2, [cv2.IMWRITE_JPEG_QUALITY, 92])
print('pass 2 px', int(m2.sum()))
