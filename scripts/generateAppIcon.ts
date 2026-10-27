/**
 * Uygulama ikonu + splash görsellerini SVG'den (kod ile, dışarıdan görsel dosya olmadan) üretir.
 * Tasarım (Faz 7): sade, tek odak -- sıcak şeftali→terrakota zemin üzerinde, küçük ahşap rafta duran
 * TEK bir sevimli turkuaz fincan (oyunun kendi eşya dili: degrade gövde, nokta gözler, ince gülümseme),
 * üstünde buhar kıvrımları ve bir ışıltı. Yazı yok (SVG metni sistem fontuna bağlı olurdu).
 *
 * Çıktılar (`npx capacitor-assets generate --android` bunları okur):
 *   assets/icon-only.png        1024  -- tam ikon (eski Android / genel kullanım)
 *   assets/icon-foreground.png  1024  -- uyarlanabilir ikon ön planı (şeffaf, konu orta %66'da)
 *   assets/icon-background.png  1024  -- uyarlanabilir ikon arka planı (degrade)
 *   assets/splash.png / splash-dark.png 2732 -- krem / koyu erik zemin + ortada ikon
 * Ayrıca public/favicon.svg (web) aynı tasarımdan yazılır.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..';
const OUT_DIR = join(ROOT, 'assets');

const C = {
  bgTop: '#FCDCC3',
  bgBottom: '#E68266',
  cream: '#FFF6EC',
  plum: '#3B2433',
  ink: '#4A3443',
  tealLight: '#5CC2B3',
  teal: '#3FA99B',
  tealDark: '#2A7D72',
  woodLight: '#EBC39C',
  wood: '#D49A6A',
  woodDark: '#A86E45',
  gold: '#FFD36B',
};

function defs(): string {
  return `
  <defs>
    <radialGradient id="bg" cx="50%" cy="28%" r="85%">
      <stop offset="0%" stop-color="${C.bgTop}"/>
      <stop offset="100%" stop-color="${C.bgBottom}"/>
    </radialGradient>
    <linearGradient id="mug" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.tealLight}"/>
      <stop offset="60%" stop-color="${C.teal}"/>
      <stop offset="100%" stop-color="${C.tealDark}"/>
    </linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.woodLight}"/>
      <stop offset="100%" stop-color="${C.wood}"/>
    </linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>`;
}

/** Fincan + raf + buhar + ışıltı -- 1024'lük tuval merkezinde, `k` ölçeğiyle (ön plan için küçültülür). */
function subject(k: number): string {
  return `
  <g transform="translate(512 512) scale(${k}) translate(-512 -512)">
    <!-- rafa düşen yumuşak gölge -->
    <ellipse cx="512" cy="742" rx="250" ry="34" fill="${C.plum}" opacity="0.22" filter="url(#soft)"/>
    <!-- raf -->
    <rect x="232" y="708" width="560" height="44" rx="22" fill="url(#wood)"/>
    <rect x="252" y="714" width="520" height="8" rx="4" fill="#FFFFFF" opacity="0.4"/>
    <rect x="232" y="738" width="560" height="14" rx="7" fill="${C.woodDark}" opacity="0.55"/>
    <!-- fincan kulbu -->
    <path d="M 640 470 C 760 470 760 640 640 640" fill="none" stroke="${C.tealDark}" stroke-width="46" stroke-linecap="round"/>
    <path d="M 640 470 C 742 470 742 640 640 640" fill="none" stroke="${C.teal}" stroke-width="30" stroke-linecap="round"/>
    <!-- fincan gövdesi -->
    <path d="M 316 404 L 708 404 L 686 640 Q 680 712 606 712 L 418 712 Q 344 712 338 640 Z" fill="url(#mug)"/>
    <!-- ağız kenarı (krem) -->
    <rect x="300" y="382" width="424" height="52" rx="26" fill="${C.cream}"/>
    <rect x="322" y="398" width="380" height="18" rx="9" fill="${C.tealDark}" opacity="0.35"/>
    <!-- gövde parlaması -->
    <path d="M 372 466 Q 376 590 420 664" fill="none" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round" opacity="0.35"/>
    <!-- yüz -->
    <circle cx="452" cy="548" r="30" fill="${C.ink}"/>
    <circle cx="580" cy="548" r="30" fill="${C.ink}"/>
    <circle cx="462" cy="536" r="10" fill="#FFFFFF" opacity="0.9"/>
    <circle cx="590" cy="536" r="10" fill="#FFFFFF" opacity="0.9"/>
    <path d="M 478 606 Q 516 640 554 606" fill="none" stroke="${C.ink}" stroke-width="16" stroke-linecap="round"/>
    <!-- buhar -->
    <path d="M 450 344 C 410 300 490 270 450 220" fill="none" stroke="${C.cream}" stroke-width="22" stroke-linecap="round" opacity="0.92"/>
    <path d="M 574 344 C 534 296 614 262 574 206" fill="none" stroke="${C.cream}" stroke-width="22" stroke-linecap="round" opacity="0.92"/>
    <!-- ışıltı -->
    <path d="M 742 238 Q 748 282 792 288 Q 748 294 742 338 Q 736 294 692 288 Q 736 282 742 238 Z" fill="${C.gold}"/>
    <circle cx="282" cy="300" r="14" fill="${C.cream}" opacity="0.85"/>
  </g>`;
}

function iconSvg(size: number, rounded = false): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  ${defs()}
  <rect width="1024" height="1024" ${rounded ? 'rx="230"' : ''} fill="url(#bg)"/>
  ${subject(1)}
</svg>`;
}

/** Uyarlanabilir ikon ön planı: şeffaf zemin, tam ölçek -- capacitor-assets her kenara %16.7 iç boşluk
 * ekler, konu (tuvalin ~%55i) böylece ikonun ~%37sine iner ve Android güvenli alanında (%61) kalır. */
function foregroundSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  ${defs()}
  ${subject(1)}
</svg>`;
}

function backgroundSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  ${defs()}
  <rect width="1024" height="1024" fill="url(#bg)"/>
</svg>`;
}

/** Splash: düz zemin + ortada yuvarlak köşeli ikon (cihazlar arası kırpmaya dayanıklı küçük merkez). */
function splashSvg(size: number, dark: boolean): string {
  const icon = 600;
  const off = (2732 - icon) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 2732 2732">
  ${defs()}
  <clipPath id="round"><rect width="1024" height="1024" rx="230"/></clipPath>
  <rect width="2732" height="2732" fill="${dark ? C.plum : C.cream}"/>
  <g transform="translate(${off} ${off}) scale(${icon / 1024})">
    <g clip-path="url(#round)">
      <rect width="1024" height="1024" fill="url(#bg)"/>
      ${subject(1)}
    </g>
  </g>
</svg>`;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  await sharp(Buffer.from(iconSvg(1024))).png().toFile(join(OUT_DIR, 'icon-only.png'));
  await sharp(Buffer.from(foregroundSvg(1024))).png().toFile(join(OUT_DIR, 'icon-foreground.png'));
  await sharp(Buffer.from(backgroundSvg(1024))).png().toFile(join(OUT_DIR, 'icon-background.png'));
  await sharp(Buffer.from(splashSvg(2732, false))).png().toFile(join(OUT_DIR, 'splash.png'));
  await sharp(Buffer.from(splashSvg(2732, true))).png().toFile(join(OUT_DIR, 'splash-dark.png'));
  writeFileSync(join(ROOT, 'public', 'favicon.svg'), iconSvg(64, true));
  console.log('assets/: icon-only, icon-foreground, icon-background (1024), splash, splash-dark (2732) + public/favicon.svg');
}

void main();
