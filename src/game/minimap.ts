/**
 * Minimap stylée : forme arrondie, relief sur les murs, cône de vision limité par les murs.
 */
import { getCell, MAP_WIDTH, MAP_HEIGHT, WALL, SPAWN } from './map.js';
import { FOV } from './player.js';
import { castRay } from './raycaster.js';

const RADIUS = 8;
const MINIMAP_SIZE = 180;
const MARGIN = 16;
const CORNER_RADIUS = 14;

const WALL_BASE = '#3d2e24';
const WALL_LIGHT = '#5c4538';
const WALL_DARK = '#2a1f18';
const FLOOR_BASE = '#1e1916';
const FLOOR_GRID = 'rgba(80,60,45,0.25)';
const OUT_OF_BOUNDS = '#0d0a09';
const PLAYER_FILL = '#e84a2c';
const PLAYER_STROKE = '#ff6b4a';
const FOV_CONE = 'rgba(232,74,44,0.12)';
const BORDER_INNER = 'rgba(120,90,70,0.5)';
const BORDER_OUTER = 'rgba(40,28,22,0.95)';
const BORDER_GLOW = 'rgba(180,120,80,0.15)';
const SHADOW_COLOR = 'rgba(0,0,0,0.5)';

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  playerX: number,
  playerY: number,
  playerAngle: number,
  screenWidth: number,
  screenHeight: number
): void {
  const x0 = screenWidth - MINIMAP_SIZE - MARGIN;
  const y0 = screenHeight - MINIMAP_SIZE - MARGIN;

  const originX = Math.floor(playerX) - RADIUS;
  const originY = Math.floor(playerY) - RADIUS;

  ctx.save();

  // Ombre portée sous la minimap
  const shadowOffset = 4;
  roundRect(ctx, x0 + shadowOffset, y0 + shadowOffset, MINIMAP_SIZE, MINIMAP_SIZE, CORNER_RADIUS + 2);
  ctx.fillStyle = SHADOW_COLOR;
  ctx.fill();

  // Bordure externe (contour épais style cadre)
  roundRect(ctx, x0, y0, MINIMAP_SIZE, MINIMAP_SIZE, CORNER_RADIUS);
  ctx.fillStyle = BORDER_OUTER;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = BORDER_GLOW;
  ctx.stroke();

  roundRect(ctx, x0 + 2, y0 + 2, MINIMAP_SIZE - 4, MINIMAP_SIZE - 4, CORNER_RADIUS - 2);
  ctx.strokeStyle = BORDER_INNER;
  ctx.stroke();

  ctx.translate(x0 + 3, y0 + 3);
  const innerW = MINIMAP_SIZE - 6;
  const innerH = MINIMAP_SIZE - 6;
  roundRect(ctx, 0, 0, innerW, innerH, CORNER_RADIUS - 3);
  ctx.clip();

  const size = 2 * RADIUS + 1;
  const cellSize = Math.min(innerW, innerH) / size;
  const pad = 0.3;
  const offsetX = (innerW - cellSize * size) / 2;
  const offsetY = (innerH - cellSize * size) / 2;

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const mx = originX + j;
      const my = originY + i;
      const px = offsetX + j * cellSize + 0.5;
      const py = offsetY + i * cellSize + 0.5;
      const cs = cellSize - 0.5;

      if (mx < 0 || mx >= MAP_WIDTH || my < 0 || my >= MAP_HEIGHT) {
        ctx.fillStyle = OUT_OF_BOUNDS;
        ctx.fillRect(px, py, cs, cs);
        continue;
      }

      const cell = getCell(mx, my);
      if (cell === 0 || cell === SPAWN) {
        ctx.fillStyle = FLOOR_BASE;
        ctx.fillRect(px, py, cs, cs);
        if ((i + j) % 2 === 0) {
          ctx.fillStyle = FLOOR_GRID;
          ctx.fillRect(px + cs * 0.2, py + cs * 0.2, cs * 0.6, cs * 0.6);
        }
      } else {
        // Mur avec petit effet de relief (biseau)
        ctx.fillStyle = WALL_BASE;
        ctx.fillRect(px + pad, py + pad, cs - pad * 2, cs - pad * 2);
        ctx.fillStyle = WALL_LIGHT;
        ctx.fillRect(px + pad, py + pad, cs - pad * 2, 1.2);
        ctx.fillRect(px + pad, py + pad, 1.2, cs - pad * 2);
        ctx.fillStyle = WALL_DARK;
        ctx.fillRect(px + pad, py + cs - pad - 1.2, cs - pad * 2, 1.2);
        ctx.fillRect(px + cs - pad - 1.2, py + pad, 1.2, cs - pad * 2);
      }
    }
  }

  const centerPx = offsetX + (playerX - originX) * cellSize + cellSize / 2;
  const centerPy = offsetY + (playerY - originY) * cellSize + cellSize / 2;

  // Cône de vision (FOV) limité par l'impact des murs
  const fovHalf = FOV / 2;
  const maxDist = 20;
  const coneSamples = 48;
  ctx.beginPath();
  ctx.moveTo(centerPx, centerPy);
  for (let k = 0; k <= coneSamples; k++) {
    const t = k / coneSamples;
    const rayAngle = playerAngle - fovHalf + t * FOV;
    const hit = castRay(playerX, playerY, rayAngle, playerAngle, maxDist);
    const hitX = playerX + Math.cos(rayAngle) * hit.distance;
    const hitY = playerY + Math.sin(rayAngle) * hit.distance;
    const px = offsetX + (hitX - originX) * cellSize;
    const py = offsetY + (hitY - originY) * cellSize;
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = FOV_CONE;
  ctx.fill();

  // Joueur : triangle orienté dans la direction du regard
  const headLen = cellSize * 0.85;
  const baseHalf = cellSize * 0.35;
  const ax = centerPx + Math.cos(playerAngle) * headLen;
  const ay = centerPy + Math.sin(playerAngle) * headLen;
  const bx = centerPx + Math.cos(playerAngle + Math.PI * 0.85) * baseHalf;
  const by = centerPy + Math.sin(playerAngle + Math.PI * 0.85) * baseHalf;
  const cx = centerPx + Math.cos(playerAngle - Math.PI * 0.85) * baseHalf;
  const cy = centerPy + Math.sin(playerAngle - Math.PI * 0.85) * baseHalf;

  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = PLAYER_FILL;
  ctx.fill();
  ctx.strokeStyle = PLAYER_STROKE;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (r <= 0 || w <= 0 || h <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
