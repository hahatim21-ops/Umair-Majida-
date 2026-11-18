// ─────────────────────────────────────────────────────────────────────────────
//  Everything you might want to edit lives here.
//  After changing EVENT, run `npm run build` (it regenerates /reception.ics too).
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT = {
  title: 'Wedding Reception – Majida & Umair',
  // Start / end in UTC (ISO 8601). 20:30 IST = 15:00 UTC.
  startUTC: '2026-12-05T15:00:00Z',
  // Placeholder end time: 23:30 IST = 18:00 UTC.
  endUTC: '2026-12-05T18:00:00Z',
  timezone: 'Asia/Kolkata',
  location: 'Bay View, Islam Gymkhana, 75-A Netaji Subhash Chandra Bose Rd, Marine Lines, Mumbai 400020',
  description: 'We cordially invite you to the Wedding Reception of Majida & Umair. #hUMtUM',
  // Stable identifier for the calendar entry (keep it unchanged once shared).
  uid: 'majida-umair-reception-20261205@humtum.invite',
  // Calendar reminder, in minutes before the start (1 day = 1440).
  reminderMinutes: 1440,
};

// Replace with an exact Google Maps pin link if you have one.
export const MAP_URL = 'https://www.google.com/maps/search/?api=1&query=Islam+Gymkhana+Marine+Lines+Mumbai';

// Static calendar file (generated at build time from EVENT).
export const ICS_PATH = '/reception.ics';

export const SITE = {
  title: 'Majida & Umair – Wedding Reception',
  description: '5 December 2026 · Bay View, Islam Gymkhana, Mumbai',
  // Public site address, e.g. 'https://majida-umair.netlify.app'.  Used for the
  // WhatsApp/OG preview image, which must be an absolute URL.  If left empty the
  // build uses Netlify's URL or Vercel's production URL automatically.
  url: '',
  themeColor: '#55602f',
};

export const MUSIC = {
  src: '/assets/audio/allahumma.mp3',
  volume: 0.6,        // target volume after the fade-in
  fadeIn: 2,          // seconds
  crossfade: 2.5,     // seconds of overlap at the loop point
  // iPhone: Web Audio is silenced by the ring/silent switch. Set true to play
  // through it (Safari 17+ only).
  ignoreSilentSwitch: false,
};

// ── helpers (no need to edit) ────────────────────────────────────────────────
const compact = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d+/, ''); // 20261205T150000Z

export function googleCalendarUrl(ev = EVENT) {
  const enc = encodeURIComponent;
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${enc(ev.title)}`
    + `&dates=${compact(ev.startUTC)}/${compact(ev.endUTC)}`
    + `&details=${enc(ev.description)}`
    + `&location=${enc(ev.location)}`
    + `&ctz=${enc(ev.timezone)}`;
}

export function icsText(ev = EVENT, now = new Date()) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  // RFC 5545 line folding at 75 octets
  const fold = (line) => {
    const bytes = new TextEncoder().encode(line);
    if (bytes.length <= 75) return line;
    const out = []; let cur = ''; let len = 0;
    for (const ch of line) {
      const n = new TextEncoder().encode(ch).length;
      if (len + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0; }
      cur += ch; len += n;
    }
    out.push(cur);
    return out.join('\r\n ');
  };
  const stamp = compact(now.toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Majida & Umair//Wedding Reception//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${compact(ev.startUTC)}`,
    `DTEND:${compact(ev.endUTC)}`,
    `SUMMARY:${esc(ev.title)}`,
    `DESCRIPTION:${esc(ev.description)}`,
    `LOCATION:${esc(ev.location)}`,
    `URL:${MAP_URL}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('Reminder: ' + ev.title)}`,
    `TRIGGER:${ev.reminderMinutes % 1440 === 0 ? `-P${ev.reminderMinutes / 1440}D` : `-PT${ev.reminderMinutes}M`}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
