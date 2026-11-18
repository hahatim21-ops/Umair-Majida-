// Measured positions, all in % of the image (x of width, y of height).
// Measured by fitting circles/ellipses to the painted frames (see README).

// UM_1 – wax seal (source 2160x3840; seal centre 555,1911 px)
export const SEAL = {
  cx: 25.69, cy: 49.77,
  // cut-out image (600px crop of the 2160px source)
  crop: { w: 27.78, h: 15.625 },
  // clickable circle, % of image width
  hit: 23,
};

// UM_3.1 – inner circle of each gold frame (source 1672x941)
export const FRAMES = [
  { cx: 29.87, cy: 58.40, r: 118.4 / 1672 * 100 },
  { cx: 49.95, cy: 58.38, r: 119.9 / 1672 * 100 },
  { cx: 69.86, cy: 58.40, r: 119.2 / 1672 * 100 },
];
// portrait-phone focus window for UM_3.1 (keeps the title, frames and hint line)
export const UM3_FOCUS = { x: 20, y: 4, w: 60, h: 96 }; // (applied in style.css)

// UM_4 – inner oval of the photo frame (source 1254x1254)
export const OVAL = { cx: 49.81, cy: 46.51, rx: 17.93, ry: 24.59 };

// UM_5 – free band between "8:30 PM ONWARDS" and the candle clusters
export const UM5_BUTTONS = { x: 29, y: 66.6, w: 42, h: 15.4 };

// Scroll cue on UM_2 (plain table front between the pillars)
export const UM2_CUE = { x: 50, y: 91.2, h: 8 };

// Gate hint: velvet below the lace, clear of the seal and strands
export const GATE_HINT = { x: 57, y: 90 }; // (applied in style.css .gate__hint)

// Painted text (and on-card buttons) per card, in % of the image. The floating music
// toggle steps aside whenever one of these passes beneath it.
export const TEXT_ZONES = {
  um2: [[27, 14, 46, 12.5], [17, 25.5, 66, 9], [12.5, 33, 75, 13.5], [8.5, 44.5, 85, 21.5], [38, 65, 24, 6], [36, 73, 28, 4]],
  um3: [[21, 7, 58, 28], [33, 32, 34, 6], [19, 39.5, 62, 38.5], [31, 76.5, 38, 6]],
  um4: [[31, 21, 38, 51]],
  um5: [[18, 36, 64, 30.5], [29, 66.6, 42, 15.4], [33, 82, 34, 3.6]],
  um6: [[9.5, 22.8, 81, 61.5], [30, 87, 27, 3.6]],
};
