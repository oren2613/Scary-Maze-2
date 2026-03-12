/**
 * Rendu 3D style Wolfenstein : texture brique, brouillard, plafond noir, sol texturé, sprites (rats).
 */
import type { RayHit } from './raycaster.js';
import { WALL, type Cell } from './map.js';
import { FOV } from './player.js';

export interface Sprite3D {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  /** -1 = vers la gauche à l'écran (image en miroir), +1 = vers la droite (image normale). */
  direction?: number;
}

const BRICK_TEXTURE_URL = '/brick-wall.png';
const FLOOR_TEXTURE_URL = '/floor.png';
const CEILING_TEXTURE_URL = '/ceiling.png';
const RAT_SPRITE_URL = '/rat.png';
const RAT_RUN_FRAMES = 6;
const RAT_FRAME_MS = 80;

const WALL_COLORS: Record<number, { main: string; dark: string }> = {
  [WALL]: { main: '#2a1814', dark: '#120a08' },
};

const FOG_COLOR = { r: 12, g: 6, b: 8 };
const FOG_START = 2;
const FOG_END = 14;

/** Distance minimale pour le rendu : doit rester <= marge de collision du joueur. */
const MIN_DISPLAY_DISTANCE = 0.35;
/** Hauteur max du mur en multiple de l'ecran. */
const MAX_WALL_HEIGHT_RATIO = 2.5;

/** Couleur du plafond (noir). */
const CEILING_COLOR = '#000000';
const FLOOR_COLOR = '#3d2b1f';

/** Hauteur relative de la caméra au-dessus du sol (pour le floor casting). */
const CAMERA_HEIGHT = 0.5;

/** Taille du rat en unités monde (réaliste, petit). */
const RAT_WORLD_HEIGHT = 0.15;
/** En dessous de cette distance le rat n'est pas affiché (trop proche). */
const RAT_MIN_VISIBLE_DISTANCE = 0.7;

/** Seuil : pixels plus sombres (fond noir/gris) deviennent transparents. */
const RAT_BG_THRESHOLD = 45;

let brickTexture: HTMLImageElement | null = null;
let ratSpriteSheet: HTMLImageElement | null = null;
/** Version de la sprite sheet avec fond rendu transparent. */
let ratSpriteSheetTransparent: HTMLCanvasElement | null = null;
let ratFallbackTexture: HTMLCanvasElement | null = null;
let floorTexture: HTMLImageElement | null = null;
let floorTexData: ImageData | null = null;
let floorTexWidth = 0;
let floorTexHeight = 0;
let ceilingTexture: HTMLImageElement | null = null;
let ceilingTexData: ImageData | null = null;
let ceilingTexWidth = 0;
let ceilingTexHeight = 0;

export function loadWallTexture(): void {
  if (brickTexture) return;
  brickTexture = new Image();
  brickTexture.src = BRICK_TEXTURE_URL;
  ratSpriteSheet = new Image();
  ratSpriteSheet.src = RAT_SPRITE_URL;
  ratSpriteSheet.onload = () => {
    if (!ratSpriteSheet || ratSpriteSheet.naturalWidth === 0) return;
    const c = document.createElement('canvas');
    c.width = ratSpriteSheet.naturalWidth;
    c.height = ratSpriteSheet.naturalHeight;
    const cx = c.getContext('2d')!;
    cx.drawImage(ratSpriteSheet, 0, 0);
    const img = cx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (r <= RAT_BG_THRESHOLD && g <= RAT_BG_THRESHOLD && b <= RAT_BG_THRESHOLD) {
        d[i + 3] = 0;
      }
    }
    cx.putImageData(img, 0, 0);
    ratSpriteSheetTransparent = c;
  };
  floorTexture = new Image();
  floorTexture.src = FLOOR_TEXTURE_URL;
  floorTexture.onload = () => {
    const c = document.createElement('canvas');
    c.width = floorTexture!.naturalWidth;
    c.height = floorTexture!.naturalHeight;
    floorTexWidth = c.width;
    floorTexHeight = c.height;
    const cx = c.getContext('2d')!;
    cx.drawImage(floorTexture!, 0, 0);
    floorTexData = cx.getImageData(0, 0, c.width, c.height);
  };
  ceilingTexture = new Image();
  ceilingTexture.src = CEILING_TEXTURE_URL;
  ceilingTexture.onload = () => {
    const c = document.createElement('canvas');
    c.width = ceilingTexture!.naturalWidth;
    c.height = ceilingTexture!.naturalHeight;
    ceilingTexWidth = c.width;
    ceilingTexHeight = c.height;
    const cx = c.getContext('2d')!;
    cx.drawImage(ceilingTexture!, 0, 0);
    ceilingTexData = cx.getImageData(0, 0, c.width, c.height);
  };
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function blendWithFog(hex: string, distance: number): string {
  const t = Math.min(1, Math.max(0, (distance - FOG_START) / (FOG_END - FOG_START)));
  const w = parseHex(hex);
  const r = Math.round(w.r * (1 - t) + FOG_COLOR.r * t);
  const g = Math.round(w.g * (1 - t) + FOG_COLOR.g * t);
  const b = Math.round(w.b * (1 - t) + FOG_COLOR.b * t);
  return `rgb(${r},${g},${b})`;
}

function fogT(distance: number): number {
  return Math.min(1, Math.max(0, (distance - FOG_START) / (FOG_END - FOG_START)));
}

function getRatFallbackTexture(): HTMLCanvasElement {
  if (ratFallbackTexture) return ratFallbackTexture;
  const size = 32;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#5c4a3a';
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.58, size * 0.32, size * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b5644';
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 0.32, size * 0.22, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ratFallbackTexture = c;
  return c;
}

function drawSprites(
  ctx: CanvasRenderingContext2D,
  sprites: Sprite3D[],
  width: number,
  height: number,
  playerAngle: number,
  playerX: number,
  playerY: number
): void {
  if (sprites.length === 0) return;
  const halfFov = FOV / 2;
  const sheet = ratSpriteSheetTransparent ?? (ratSpriteSheet?.complete && ratSpriteSheet.naturalWidth ? ratSpriteSheet : null);
  const sheetW = sheet && 'naturalWidth' in sheet ? sheet.naturalWidth : (sheet?.width ?? 0);
  const sheetH = sheet && 'naturalHeight' in sheet ? sheet.naturalHeight : (sheet?.height ?? 0);
  const frameIndex = sheet
    ? Math.floor((Date.now() / RAT_FRAME_MS) % RAT_RUN_FRAMES)
    : 0;
  const withDist = sprites.map((s) => {
    const dx = s.x - playerX;
    const dy = s.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angleToSprite = Math.atan2(dy, dx);
    let relAngle = angleToSprite - playerAngle;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;
    const perpDist = dist * Math.cos(relAngle);
    return { sprite: s, perpDist, relAngle };
  });
  const visible = withDist.filter(
    (w) => w.perpDist > RAT_MIN_VISIBLE_DISTANCE && Math.abs(w.relAngle) < halfFov + 0.2
  );
  visible.sort((a, b) => b.perpDist - a.perpDist);
  for (const { sprite, perpDist, relAngle } of visible) {
    const screenX = width / 2 + (relAngle / halfFov) * (width / 2);
    const spriteH = (RAT_WORLD_HEIGHT * height) / perpDist;
    const y = height - spriteH;
    let spriteW: number;
    if (sheet && sheetW > 0 && sheetH > 0) {
      const frameW = sheetW / RAT_RUN_FRAMES;
      spriteW = (frameW / sheetH) * spriteH;
    } else {
      const fallback = getRatFallbackTexture();
      spriteW = (fallback.width / fallback.height) * spriteH;
    }
    const flipLeft = sprite.direction === -1;
    if (flipLeft) {
      ctx.save();
      ctx.translate(screenX, y + spriteH / 2);
      ctx.scale(-1, 1);
      ctx.translate(-screenX, -(y + spriteH / 2));
    }
    ctx.globalAlpha = 1 - fogT(perpDist) * 0.7;
    if (sheet && sheetW > 0 && sheetH > 0) {
      const frameW = sheetW / RAT_RUN_FRAMES;
      const srcX = frameIndex * frameW;
      ctx.drawImage(sheet, srcX, 0, frameW, sheetH, screenX - spriteW / 2, y, spriteW, spriteH);
    } else {
      const fallback = getRatFallbackTexture();
      ctx.drawImage(fallback, screenX - spriteW / 2, y, spriteW, spriteH);
    }
    if (flipLeft) ctx.restore();
    ctx.globalAlpha = 1;
    const fog = fogT(perpDist);
    if (fog > 0.01) {
      ctx.fillStyle = `rgba(${FOG_COLOR.r},${FOG_COLOR.g},${FOG_COLOR.b},${fog * 0.6})`;
      ctx.fillRect(screenX - spriteW / 2, y, spriteW, spriteH);
    }
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  rays: RayHit[],
  width: number,
  height: number,
  playerAngle: number,
  playerX: number,
  playerY: number,
  sprites: Sprite3D[] = []
): void {
  const halfHeight = height / 2;
  const stripWidth = width / rays.length;
  const halfFov = FOV / 2;

  if (ceilingTexData && ceilingTexWidth > 0 && ceilingTexHeight > 0) {
    const ceilingRows = halfHeight;
    const ceilingImageData = ctx.createImageData(width, ceilingRows);
    const cd = ceilingTexData.data;
    const out = ceilingImageData.data;
    for (let sy = 0; sy < ceilingRows; sy++) {
      const rowDist = ((1 - CAMERA_HEIGHT) * height) / (ceilingRows - sy - 0.5);
      const t = fogT(rowDist);
      for (let sx = 0; sx < width; sx++) {
        const angle = playerAngle - halfFov + (sx / width) * FOV;
        const ceilX = playerX + Math.cos(angle) * rowDist;
        const ceilY = playerY + Math.sin(angle) * rowDist;
        const tu = ((ceilX % 1) + 1) % 1;
        const tv = ((ceilY % 1) + 1) % 1;
        const tx = Math.min(ceilingTexWidth - 1, Math.floor(tu * ceilingTexWidth));
        const ty = Math.max(0, Math.min(ceilingTexHeight - 1, ceilingTexHeight - 1 - Math.floor(tv * ceilingTexHeight)));
        const i = (ty * ceilingTexWidth + tx) * 4;
        let r = cd[i];
        let g = cd[i + 1];
        let b = cd[i + 2];
        r = Math.round(r * (1 - t) + FOG_COLOR.r * t);
        g = Math.round(g * (1 - t) + FOG_COLOR.g * t);
        b = Math.round(b * (1 - t) + FOG_COLOR.b * t);
        const o = (sy * width + sx) * 4;
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = 255;
      }
    }
    ctx.putImageData(ceilingImageData, 0, 0);
  } else {
    ctx.fillStyle = CEILING_COLOR;
    ctx.fillRect(0, 0, width, halfHeight);
  }

  if (floorTexData && floorTexWidth > 0 && floorTexHeight > 0) {
    const floorRows = halfHeight;
    const floorImageData = ctx.createImageData(width, floorRows);
    const fd = floorTexData.data;
    const out = floorImageData.data;
    for (let sy = 0; sy < floorRows; sy++) {
      const rowDist = (CAMERA_HEIGHT * height) / (sy + 0.5);
      const t = fogT(rowDist);
      for (let sx = 0; sx < width; sx++) {
        const angle = playerAngle - halfFov + (sx / width) * FOV;
        const floorX = playerX + Math.cos(angle) * rowDist;
        const floorY = playerY + Math.sin(angle) * rowDist;
        const tu = ((floorX % 1) + 1) % 1;
        const tv = ((floorY % 1) + 1) % 1;
        const tx = Math.min(floorTexWidth - 1, Math.floor(tu * floorTexWidth));
        const ty = Math.min(floorTexHeight - 1, Math.floor(tv * floorTexHeight));
        const i = (ty * floorTexWidth + tx) * 4;
        let r = fd[i];
        let g = fd[i + 1];
        let b = fd[i + 2];
        r = Math.round(r * (1 - t) + FOG_COLOR.r * t);
        g = Math.round(g * (1 - t) + FOG_COLOR.g * t);
        b = Math.round(b * (1 - t) + FOG_COLOR.b * t);
        const o = (sy * width + sx) * 4;
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = 255;
      }
    }
    ctx.putImageData(floorImageData, 0, halfHeight);
  } else {
    ctx.fillStyle = FLOOR_COLOR;
    ctx.fillRect(0, halfHeight, width, halfHeight);
  }

  const tex = brickTexture?.complete && brickTexture.naturalWidth ? brickTexture : null;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  for (let i = 0; i < rays.length; i++) {
    const ray = rays[i];
    const perp = Math.max(ray.perpDistance, MIN_DISPLAY_DISTANCE);
    const wallH = Math.min(height * MAX_WALL_HEIGHT_RATIO, height / perp);
    const top = (height - wallH) / 2;
    const stripX = i * stripWidth;
    const fogT = Math.min(1, Math.max(0, (ray.perpDistance - FOG_START) / (FOG_END - FOG_START)));

    if (tex) {
      const tw = tex.naturalWidth;
      const th = tex.naturalHeight;
      const srcX = Math.max(0, Math.min(Math.floor(ray.wallU * (tw - 1)), tw - 1));
      ctx.drawImage(tex, srcX, 0, 1, th, stripX, top, stripWidth + 1, wallH);
      if (ray.side === 'ns') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(stripX, top, stripWidth + 1, wallH);
      }
      if (fogT > 0.01) {
        ctx.fillStyle = `rgba(${FOG_COLOR.r},${FOG_COLOR.g},${FOG_COLOR.b},${fogT})`;
        ctx.fillRect(stripX, top, stripWidth + 1, wallH);
      }
    } else {
      const colors = WALL_COLORS[ray.wallType as Cell] ?? WALL_COLORS[1];
      const baseColor = ray.side === 'ns' ? colors.dark : colors.main;
      ctx.fillStyle = blendWithFog(baseColor, ray.perpDistance);
      ctx.fillRect(stripX, top, stripWidth + 1, wallH);
    }
  }
  drawSprites(ctx, sprites, width, height, playerAngle, playerX, playerY);
  ctx.restore();
}
