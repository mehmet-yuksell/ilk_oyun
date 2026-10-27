import Phaser from 'phaser';
import { bakeCentered } from './bake';
import { COLORS, EASE, hexToNum, mix, shadeHex, textStyle, type TextRole } from './theme';
import { cssToLogical } from './viewport';

/**
 * Ortak UI bileşenleri. Butonlar pişmiş dokudan (bkz. bake.ts): yumuşak degrade yüz + altta hafif
 * 3B "dudak" + yumuşak gölge -- eski "parlak üst şerit" (2010'ların glossy tarzı) yok.
 *
 * Basılma hissi: parmak değince yüz küçülür ve dudağa doğru iner (scale-down), bırakınca Back.Out
 * ile geri yayılır ve eylem o anda tetiklenir; parmak dışarı kayarsa basış iptal olur.
 * Dokunma alanı her zaman en az 48x48 CSS px (≈ dp) -- mantıksal birimde değil (bkz. minTouch).
 */

/** Android/iOS önerisi: en az 48 dp (CSS px) dokunma hedefi. */
export const MIN_TOUCH = 48;

/** MIN_TOUCH'ın bu sahnedeki mantıksal karşılığı (telefonda ~66 birim). */
export function minTouch(scene: Phaser.Scene): number {
  return Math.max(MIN_TOUCH, cssToLogical(scene, MIN_TOUCH));
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'sage' | 'honey';

interface VariantColors {
  readonly face: string;
  readonly text: string;
  readonly border?: string;
}

const VARIANTS: Record<ButtonVariant, VariantColors> = {
  primary: { face: COLORS.terracotta, text: COLORS.cream },
  sage: { face: '#7FB28A', text: COLORS.cream },
  honey: { face: '#EDB04A', text: COLORS.ink },
  secondary: { face: COLORS.surfaceWarm, text: COLORS.ink, border: COLORS.woodLight },
  ghost: { face: COLORS.surfaceWarm, text: COLORS.inkSoft, border: COLORS.inkFaint },
};

const DISABLED: VariantColors = { face: COLORS.surfaceMuted, text: COLORS.inkSoft };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const LIP = 4;
const PAD = 14;

/** Butonun "dudak" (alt kenar) + gölge katmanı -- yüzden ayrı, basılınca yüz bunun üstüne iner. */
function paintBase(ctx: CanvasRenderingContext2D, w: number, h: number, c: VariantColors, radius: number): void {
  const s = ctx.getTransform().a;
  ctx.save();
  ctx.shadowColor = 'rgba(90,58,44,0.26)';
  ctx.shadowBlur = 10 * s;
  ctx.shadowOffsetY = 4 * s;
  roundRect(ctx, -w / 2, -h / 2 + LIP, w, h, radius);
  ctx.fillStyle = shadeHex(c.border ?? c.face, -0.28);
  ctx.fill();
  ctx.restore();
}

function paintFace(ctx: CanvasRenderingContext2D, w: number, h: number, c: VariantColors, radius: number): void {
  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, mix(c.face, '#FFFFFF', 0.16));
  grad.addColorStop(1, shadeHex(c.face, -0.06));
  roundRect(ctx, -w / 2, -h / 2, w, h, radius);
  ctx.fillStyle = grad;
  ctx.fill();
  if (c.border) {
    roundRect(ctx, -w / 2 + 1, -h / 2 + 1, w - 2, h - 2, radius);
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // üst iç ışık: tek ince çizgi (glossy şerit değil)
  ctx.save();
  roundRect(ctx, -w / 2, -h / 2, w, h, radius);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  roundRect(ctx, -w / 2 + 1.5, -h / 2 + 1.5, w - 3, h + 6, radius);
  ctx.stroke();
  ctx.restore();
}

export interface UIButton {
  readonly root: Phaser.GameObjects.Container;
  setEnabled(enabled: boolean): void;
  setLabel(label: string): void;
  /** Dikkat çeken yumuşak nabız (ör. "Sonraki Seviye"). */
  pulse(): void;
  destroy(): void;
}

export interface ButtonOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly textRole?: TextRole;
  /** Sol tarafa çizilecek küçük ikon (Graphics benzeri çizim, merkez orijin, ~20px). */
  readonly icon?: (g: Phaser.GameObjects.Graphics, color: number) => void;
  readonly radius?: number;
  readonly onTap: () => void;
  /** true dönerse dokunuş yok sayılır (ör. animasyon sürerken). Her basışta canlı okunur. */
  readonly isBlocked?: () => boolean;
  /** Basış anında çağrılır (ses/haptik). */
  readonly onPress?: () => void;
}

function bakeButton(scene: Phaser.Scene, w: number, h: number, radius: number, variant: string, c: VariantColors) {
  const size = { width: w + PAD * 2, height: h + PAD * 2 + LIP };
  const tag = `${variant}-${Math.round(w)}x${Math.round(h)}-${radius}`;
  return {
    size,
    base: bakeCentered(scene, `btn-base-${tag}`, size, (_g, ctx) => paintBase(ctx, w, h, c, radius)),
    face: bakeCentered(scene, `btn-face-${tag}`, size, (_g, ctx) => paintFace(ctx, w, h, c, radius)),
  };
}

export function createButton(scene: Phaser.Scene, opts: ButtonOptions): UIButton {
  const variant = opts.variant ?? 'primary';
  const radius = opts.radius ?? opts.height / 2;
  const colors = VARIANTS[variant];
  const normal = bakeButton(scene, opts.width, opts.height, radius, variant, colors);
  const disabled = bakeButton(scene, opts.width, opts.height, radius, 'disabled', DISABLED);

  const root = scene.add.container(opts.x, opts.y);
  const base = scene.add.image(0, 0, normal.base).setDisplaySize(normal.size.width, normal.size.height);
  const faceGroup = scene.add.container(0, 0);
  const face = scene.add.image(0, 0, normal.face).setDisplaySize(normal.size.width, normal.size.height);
  faceGroup.add(face);

  const role = opts.textRole ?? (opts.height >= 54 ? 'button' : 'buttonSmall');
  const iconG = opts.icon ? scene.add.graphics() : null;
  const label = scene.add.text(0, -1, opts.label, textStyle(role, { color: colors.text })).setOrigin(0.5);
  faceGroup.add(label);
  if (iconG) faceGroup.add(iconG);

  const layoutContent = () => {
    if (!iconG) {
      label.setX(0);
      return;
    }
    const gap = 8;
    const iconW = 20;
    const total = iconW + gap + label.width;
    iconG.setPosition(-total / 2 + iconW / 2, 0);
    label.setX(-total / 2 + iconW + gap + label.width / 2);
  };
  const drawIcon = (enabled: boolean) => {
    if (!iconG || !opts.icon) return;
    iconG.clear();
    opts.icon(iconG, hexToNum(enabled ? colors.text : DISABLED.text));
  };
  drawIcon(true);
  layoutContent();

  const zone = scene.add.zone(0, 0, Math.max(minTouch(scene), opts.width), Math.max(minTouch(scene), opts.height + LIP)).setInteractive({ useHandCursor: true });
  root.add([base, faceGroup, zone]);

  let enabled = true;
  let pressed = false;
  let pulseTween: Phaser.Tweens.Tween | null = null;

  const press = () => {
    if (!enabled || opts.isBlocked?.()) return;
    pressed = true;
    opts.onPress?.();
    scene.tweens.killTweensOf(faceGroup);
    scene.tweens.add({ targets: faceGroup, y: LIP - 1, scaleX: 0.96, scaleY: 0.94, duration: 70, ease: EASE.out });
  };
  const release = (fire: boolean) => {
    if (!pressed) return;
    pressed = false;
    scene.tweens.killTweensOf(faceGroup);
    scene.tweens.add({ targets: faceGroup, y: 0, scaleX: 1, scaleY: 1, duration: 260, ease: EASE.back });
    if (fire && enabled && !opts.isBlocked?.()) opts.onTap();
  };
  zone.on('pointerdown', press);
  zone.on('pointerup', () => release(true));
  zone.on('pointerout', () => release(false));

  return {
    root,
    setEnabled(value: boolean) {
      if (enabled === value) return;
      enabled = value;
      const set = value ? normal : disabled;
      base.setTexture(set.base).setDisplaySize(set.size.width, set.size.height);
      face.setTexture(set.face).setDisplaySize(set.size.width, set.size.height);
      label.setColor(value ? colors.text : DISABLED.text);
      drawIcon(value);
      zone.input!.cursor = value ? 'pointer' : 'default';
    },
    setLabel(value: string) {
      label.setText(value);
      layoutContent();
    },
    pulse() {
      pulseTween?.stop();
      pulseTween = scene.tweens.add({ targets: root, scale: { from: 1, to: 1.05 }, duration: 620, yoyo: true, repeat: -1, ease: EASE.inOut });
    },
    destroy() {
      pulseTween?.stop();
      scene.tweens.killTweensOf([root, faceGroup]);
      root.destroy();
    },
  };
}

/** Yuvarlak ikon butonu (geri, ayarlar, ses...) -- aynı basılma dili, en az 48x48 dokunma alanı. */
export function createIconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  drawIcon: (g: Phaser.GameObjects.Graphics, color: number) => void,
  onTap: () => void,
  options: { size?: number; variant?: ButtonVariant; isBlocked?: () => boolean; onPress?: () => void } = {},
): UIButton {
  const size = options.size ?? 50;
  const btn = createButton(scene, {
    x,
    y,
    width: size,
    height: size,
    label: '',
    variant: options.variant ?? 'secondary',
    onTap,
    isBlocked: options.isBlocked,
    onPress: options.onPress,
  });
  const g = scene.add.graphics();
  drawIcon(g, hexToNum(COLORS.ink));
  (btn.root.list[1] as Phaser.GameObjects.Container).add(g);
  return btn;
}

/** Yumuşak katmanlı gölgeli, yuvarlak köşeli panel kartı (pişmiş). */
export function addPanelCard(scene: Phaser.Scene, container: Phaser.GameObjects.Container, w: number, h: number, radius = 28): Phaser.GameObjects.Image {
  const pad = 30;
  const size = { width: w + pad * 2, height: h + pad * 2 };
  const key = bakeCentered(scene, `panel-${Math.round(w)}x${Math.round(h)}-${radius}`, size, (_g, ctx) => {
    const s = ctx.getTransform().a;
    ctx.save();
    ctx.shadowColor = 'rgba(59,36,51,0.35)';
    ctx.shadowBlur = 26 * s;
    ctx.shadowOffsetY = 10 * s;
    roundRect(ctx, -w / 2, -h / 2, w, h, radius);
    ctx.fillStyle = COLORS.surfaceWarm;
    ctx.fill();
    ctx.restore();
    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(1, '#FBF1E5');
    roundRect(ctx, -w / 2, -h / 2, w, h, radius);
    ctx.fillStyle = grad;
    ctx.fill();
    roundRect(ctx, -w / 2 + 1, -h / 2 + 1, w - 2, h - 2, radius);
    ctx.strokeStyle = 'rgba(212,154,106,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  const img = scene.add.image(0, 0, key).setDisplaySize(size.width, size.height);
  container.add(img);
  return img;
}

/** Panel başlığı için kurdele (kuyruklu bant) -- sıcak renkte, panelin üst kenarına oturur. */
export function addRibbon(scene: Phaser.Scene, container: Phaser.GameObjects.Container, y: number, w: number, color: string, text: string, textColor: string = COLORS.cream): void {
  const h = 52;
  const tail = 22;
  const size = { width: w + tail * 2 + 20, height: h + 30 };
  const key = bakeCentered(scene, `ribbon-${Math.round(w)}-${color}`, size, (_g, ctx) => {
    const s = ctx.getTransform().a;
    // kuyruklar (arkada, daha koyu)
    ctx.fillStyle = shadeHex(color, -0.25);
    for (const dir of [-1, 1]) {
      const x0 = dir * (w / 2 - 6);
      const x1 = dir * (w / 2 + tail);
      ctx.beginPath();
      ctx.moveTo(x0, -h / 2 + 10);
      ctx.lineTo(x1, -h / 2 + 10);
      ctx.lineTo(x1 - dir * 10, h / 4 + 6);
      ctx.lineTo(x1, h / 2 + 10);
      ctx.lineTo(x0, h / 2 + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.save();
    ctx.shadowColor = 'rgba(90,58,44,0.25)';
    ctx.shadowBlur = 8 * s;
    ctx.shadowOffsetY = 3 * s;
    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, mix(color, '#FFFFFF', 0.18));
    grad.addColorStop(1, shadeHex(color, -0.05));
    roundRect(ctx, -w / 2, -h / 2, w, h, 14);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    roundRect(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 10);
    ctx.stroke();
  });
  container.add(scene.add.image(0, y, key).setDisplaySize(size.width, size.height));
  container.add(scene.add.text(0, y - 1, text, textStyle('panelTitle', { color: textColor })).setOrigin(0.5));
}

export interface UIToggle {
  readonly root: Phaser.GameObjects.Container;
  setValue(value: boolean, animate?: boolean): void;
}

/**
 * Gerçek bir açma/kapama anahtarı (eski "Açık / Kapalı" hap çifti yerine): adaçayı yeşili ray, beyaz
 * düğme Back.Out ile kayar. Dokunma alanı satır genişliğinde verilebilir (hitWidth).
 */
export function createToggle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: boolean,
  onChange: (value: boolean) => void,
  hitWidth = 72,
): UIToggle {
  const w = 58;
  const h = 34;
  const root = scene.add.container(x, y);
  const track = scene.add.graphics();
  const knobShadow = scene.add.circle(0, 2, h / 2 - 4, hexToNum(COLORS.overlay), 0.18);
  const knob = scene.add.circle(0, 0, h / 2 - 4, 0xffffff, 1);
  const zone = scene.add.zone(0, 0, Math.max(minTouch(scene), hitWidth), minTouch(scene)).setInteractive({ useHandCursor: true });
  root.add([track, knobShadow, knob, zone]);

  let current = value;
  const knobX = (v: boolean) => (v ? w / 2 - h / 2 : -w / 2 + h / 2);
  const drawTrack = (v: boolean) => {
    track.clear();
    track.fillStyle(hexToNum(v ? '#7FB28A' : COLORS.surfaceMuted), 1);
    track.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    track.lineStyle(1.5, hexToNum(v ? '#5E9A6B' : COLORS.inkFaint), 0.8);
    track.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  };
  const apply = (v: boolean, animate: boolean) => {
    drawTrack(v);
    scene.tweens.killTweensOf([knob, knobShadow]);
    if (animate) scene.tweens.add({ targets: [knob, knobShadow], x: knobX(v), duration: 260, ease: EASE.back });
    else {
      knob.x = knobX(v);
      knobShadow.x = knobX(v);
    }
  };
  apply(current, false);
  zone.on('pointerup', () => {
    current = !current;
    apply(current, true);
    onChange(current);
  });

  return {
    root,
    setValue(v: boolean, animate = true) {
      current = v;
      apply(v, animate);
    },
  };
}

/** İki seçenekli kayan seçici (ör. TR / EN): aktif dilim terrakota "kayar". */
export function createSegmented(
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: readonly { label: string; value: string }[],
  value: string,
  onChange: (value: string) => void,
): Phaser.GameObjects.Container {
  const segW = 68;
  const h = 36;
  const w = segW * options.length + 6;
  const root = scene.add.container(x, y);
  const track = scene.add.graphics();
  track.fillStyle(hexToNum(COLORS.surfaceMuted), 1);
  track.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const thumb = scene.add.graphics();
  thumb.fillStyle(hexToNum(COLORS.terracotta), 1);
  thumb.fillRoundedRect(-segW / 2, -h / 2 + 3, segW, h - 6, (h - 6) / 2);
  root.add([track, thumb]);
  const segX = (i: number) => -w / 2 + 3 + segW * i + segW / 2;
  const labels: Phaser.GameObjects.Text[] = [];
  let index = Math.max(0, options.findIndex((o) => o.value === value));
  thumb.x = segX(index);
  options.forEach((opt, i) => {
    const label = scene.add.text(segX(i), -1, opt.label, textStyle('buttonSmall', { color: i === index ? COLORS.cream : COLORS.inkSoft })).setOrigin(0.5);
    labels.push(label);
    const zone = scene.add.zone(segX(i), 0, Math.max(segW, minTouch(scene) * 0.9), minTouch(scene)).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      if (i === index) return;
      index = i;
      scene.tweens.add({ targets: thumb, x: segX(i), duration: 240, ease: EASE.back });
      labels.forEach((l, j) => l.setColor(j === i ? COLORS.cream : COLORS.inkSoft));
      onChange(opt.value);
    });
    root.add([label, zone]);
  });
  return root;
}

/** Yıldız sayacı çipi (krem hap + altın yıldız + sayı). */
export function createStarChip(scene: Phaser.Scene, x: number, y: number, starKey: string, value: number): { root: Phaser.GameObjects.Container; setValue(v: number): void; star: Phaser.GameObjects.Image } {
  const root = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const text = scene.add.text(14, -1, `${value}`, textStyle('hud')).setOrigin(0, 0.5);
  const star = scene.add.image(-2, 0, starKey).setDisplaySize(28, 28);
  const draw = () => {
    const w = Math.max(84, text.width + 54);
    bg.clear();
    bg.fillStyle(0xffffff, 0.92);
    bg.fillRoundedRect(-22, -20, w, 40, 20);
    bg.lineStyle(1.5, hexToNum(COLORS.woodLight), 0.8);
    bg.strokeRoundedRect(-22, -20, w, 40, 20);
  };
  draw();
  root.add([bg, star, text]);
  return {
    root,
    star,
    setValue(v: number) {
      text.setText(`${v}`);
      draw();
    },
  };
}
