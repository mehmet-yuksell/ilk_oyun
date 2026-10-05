/**
 * Uygulama ikonu ve splash görselini SVG'den (kod ile, dışarıdan görsel dosya olmadan)
 * üretir. Oyunun kendi palet/şekil kimliğini kullanır (bkz. src/scenes/itemVisuals.ts):
 * kiremit zemin + kap içine yerleşen üç farklı şekil (dikdörtgen/daire/altıgen).
 * Çıktılar `assets/icon.png` ve `assets/splash.png` -- bunlar `npx capacitor-assets generate`
 * tarafından okunup android res klasörlerine dağıtılır.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..';
const OUT_DIR = join(ROOT, 'assets');

const BG = '#d9704f'; // kiremit (book)
const CREAM = '#fff8f0';
const TEAL = '#4f9d8c'; // cup
const MUSTARD = '#c9a53b'; // pot

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

function iconSvg(size: number): string {
  const cx = size / 2;
  // Kap: zeminin alt yarısında ince krem çerçeveli bir "yuva".
  const slotW = size * 0.62;
  const slotH = size * 0.3;
  const slotX = cx - slotW / 2;
  const slotY = size * 0.6;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.16}" fill="${BG}" />
  <rect x="${slotX}" y="${slotY}" width="${slotW}" height="${slotH}" rx="${size * 0.05}"
        fill="none" stroke="${CREAM}" stroke-width="${size * 0.018}" opacity="0.85" />
  <rect x="${cx - size * 0.17}" y="${size * 0.22}" width="${size * 0.22}" height="${size * 0.22}" rx="${size * 0.045}" fill="${CREAM}" />
  <circle cx="${cx + size * 0.14}" cy="${size * 0.4}" r="${size * 0.13}" fill="${TEAL}" />
  <polygon points="${hexPoints(cx - size * 0.02, size * 0.56, size * 0.14)}" fill="${MUSTARD}" />
</svg>`;
}

function splashSvg(size: number): string {
  const safe = size * 0.42; // güvenli alan: cihazlar arası farklı kırpmalara dayanıklı merkez ikon boyutu
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#fbf3e7" />
  <g transform="translate(${(size - safe) / 2}, ${(size - safe) / 2})">
    ${iconSvg(safe).replace(/<\?xml.*\?>/, '').replace(/<svg[^>]*>/, '').replace('</svg>', '')}
  </g>
</svg>`;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  await sharp(Buffer.from(iconSvg(1024))).png().toFile(join(OUT_DIR, 'icon.png'));
  await sharp(Buffer.from(splashSvg(2732))).png().toFile(join(OUT_DIR, 'splash.png'));
  console.log('Generated assets/icon.png (1024x1024) and assets/splash.png (2732x2732)');
}

void main();
