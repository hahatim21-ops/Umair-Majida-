// Motion / power flags shared by every module.
const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
const nav = typeof navigator !== 'undefined' ? navigator : {};
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

export const reducedMotion = mq('(prefers-reduced-motion: reduce)') || params.has('calm');
export const lowPower =
  !!(nav.connection && nav.connection.saveData) ||
  (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
  (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2);

// "calm" = no sway, no parallax, no ambient loops; only gentle fades + static flame glow.
export const calm = reducedMotion || lowPower;
export const isTouch = mq('(pointer: coarse)');
export const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);

// Runtime downgrade if the device can't keep up (set by the sway renderer's frame monitor).
export const runtime = { swayDisabled: false };
