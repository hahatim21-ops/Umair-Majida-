# Majida & Umair – Wedding Reception

A one-page, mobile-first invitation: a wax-seal gate whose curtain draws aside, then five cards stacked edge to edge in one continuous column (full width on phones, 520px wide on larger screens with a blurred backdrop beside it), scratch-off date and photo, candle lighting, and background music.

Built with Vite (vanilla JS), GSAP + ScrollTrigger, Lenis, and a small custom WebGL shader for the sway effect.

## Run it locally

```powershell
npm install
npm run dev
```

Then open http://localhost:5173. `npm run build` writes the production site to `dist/`, and `npm run preview` serves that build.

> The npm scripts call Vite through `node node_modules/vite/bin/vite.js`, because the Windows shims break on folder names that contain `&` (like this one).

## Editing the event: `src/config.js`

Everything you might want to change lives in this one file:

| Setting | What it controls |
| --- | --- |
| `EVENT.title`, `description`, `location` | Google Calendar link and `/reception.ics` |
| `EVENT.startUTC`, `EVENT.endUTC` | Times in **UTC** (20:30 IST = `15:00Z`). The end time `18:00Z` (23:30 IST) is a placeholder. |
| `EVENT.reminderMinutes` | Calendar reminder (1440 = 1 day before) |
| `EVENT.uid` | Calendar entry ID. Keep it unchanged once the invite is shared. |
| `MAP_URL` | The "View Location" button. Paste an exact Google Maps pin link here if you have one. |
| `SITE.title`, `description`, `themeColor` | Page title and WhatsApp/social preview text |
| `SITE.url` | Your public address, e.g. `https://majida-umair.netlify.app`. The WhatsApp preview image needs an absolute URL. If you leave it empty, Netlify's `URL` or Vercel's production URL is used automatically. |
| `MUSIC` | Volume (0.6), fade-in (2 s), loop crossfade (2.5 s). `ignoreSilentSwitch: true` makes iPhones play the music even when the ring/silent switch is on (Safari 17+). |

`npm run dev` and `npm run build` regenerate `public/reception.ics` from this file every time they run, and `npm run ics` regenerates it on its own.

## Layout data (all in % of each image)

- `src/data/layout.js`: the seal, the inner circles of the three gold frames on UM_3.1, the UM_4 photo oval, the free band for the UM_5 buttons, and where the scroll cue and gate hint sit. These were measured by fitting circles and ellipses to the painted frames.
- `src/data/flames/UM_5.json` and `UM_6.json`: one entry per painted flame. `x` and `y` are the centre of the flame, in % of the image width and height. `h` is the flame height in % of the image width. The flames light from the outside in (the furthest from the centre line go first). To move a flame, change its `x`/`y`. To add one, add a line.
- `src/data/strands.js`: pearl-strand paths (point lists in %) that the travelling glints follow.

### Sway masks: `src/data/masks/*.json` → `public/assets/masks/*.png`

Each mask is a list of blurred shapes in %. White means "may sway" and black means "frozen". Every piece of text, the seal, the gold frames, the photo oval, the candles and the lanterns are black, so they never warp. Each shape is one of:

```json
{ "rect": [x, y, w, h], "v": 0..1 }           // solid grey value
{ "rect": [x, y, w, h], "grad": [top, bottom] } // vertical gradient: lower ends swing more
{ "ellipse": [cx, cy, rx, ry], "v": 0 }
{ "poly": [[x, y], ...], "v": 1 }
```

Shapes are painted in order, so the later black text boxes win. `blur` is the feather, in % of the width. After editing a mask, run `npm run assets masks` to re-render the PNGs.

## Rebuilding the images

The originals in `/assets` are never modified. `npm run assets` (which uses sharp) regenerates everything in `public/`:

- the card images as AVIF, WebP and JPEG at about 1440w and 828w
- the tiny pre-blurred backdrops
- the pearl discs cropped from UM_3
- `og.jpg` (1200×630, from the seal area of UM_1)
- the favicons
- the masks
- `assets/audio/allahumma.mp3`, re-encoded at 96 kbps with ffmpeg; if ffmpeg is missing, the original is copied instead

You can also rebuild one part at a time: `npm run assets cardImages | discs | ogAndIcons | masks | audio`.

Two derived plates come from one-off Python helpers (they need opencv-python, scipy and pillow). Their outputs are committed in `assets/derived/`, so you only need to run these if the source images change:

- `python scripts/derive_seal.py`: cuts out the seal (used for the favicons).
- `python scripts/derive_blank_um2.py`: a text-free copy of UM_2, so the text can "write itself in" over it.

## Deploying

Generated assets are committed, so the host only runs `npm run build`.

**Netlify:** connect the repo, or drag the `dist/` folder onto app.netlify.com/drop. `netlify.toml` already sets the build command, `dist/`, and the header that serves `/reception.ics` as `text/calendar`.

**Vercel:** import the repo. `vercel.json` sets the same build settings and headers.

The calendar file is a static `/reception.ics` on purpose: blob downloads fail inside the WhatsApp and Instagram in-app browsers.

After deploying, paste the URL into WhatsApp to check the preview (title, date line and seal image). WhatsApp caches previews, so test with a fresh URL such as `?v=2` if you change it.

## Motion and accessibility

- **Reduced motion:** with `prefers-reduced-motion`, on low-power devices (Save-Data, ≤2 GB RAM or ≤2 cores), or with `?calm` in the URL, the site turns off sway, parallax, glints, particles and flicker. It keeps gentle fades and a static candle glow, and the gate fades out instead of splitting. If the device drops below about 40 fps for around 4 seconds, sway also switches itself off.
- **Off-screen effects:** sections that are off screen pause all their effects.
- **Keyboard:** the seal is a real button (Enter or Space). Each scratch card has a quiet "Reveal" button for keyboard and screen-reader users; it sits inside the card and only appears when focused, so nothing breaks the seamless column. The calendar sheet traps focus and closes with Esc.
- **Music toggle:** it fades aside whenever painted text passes beneath it while scrolling (text areas are listed in `TEXT_ZONES` in `src/data/layout.js`).
- **Screen readers:** every card image's alt text transcribes its painted text.
