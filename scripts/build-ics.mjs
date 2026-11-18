// Writes public/reception.ics from src/config.js (runs before dev and build).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENT, icsText } from '../src/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'reception.ics');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, icsText(EVENT));
console.log('wrote', path.relative(root, out));
