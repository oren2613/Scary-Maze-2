/**
 * Raycasting : algorithme DDA (Digital Differential Analysis).
 * Pour chaque colonne d'écran, on lance un rayon et on trouve la distance au mur.
 */
import { getCell, SPAWN, type Cell } from './map.js';
import { Player, FOV } from './player.js';

export interface RayHit {
  /** Distance réelle le long du rayon. */
  distance: number;
  /** Distance perpendiculaire au plan de la caméra (anti-fisheye), pour la hauteur des murs. */
  perpDistance: number;
  wallType: Cell;
  side: 'ns' | 'ew'; // nord/sud ou est/ouest (pour ombre)
  /** Position le long du mur (0–1) pour le texture mapping. */
  wallU: number;
}

export function castRay(
  px: number,
  py: number,
  rayAngle: number,
  playerAngle: number,
  maxDist: number = 20
): RayHit {
  const sin = Math.sin(rayAngle);
  const cos = Math.cos(rayAngle);

  const mapX = Math.floor(px);
  const mapY = Math.floor(py);

  const deltaDistX = Math.abs(cos) < 1e-10 ? Infinity : Math.abs(1 / cos);
  const deltaDistY = Math.abs(sin) < 1e-10 ? Infinity : Math.abs(1 / sin);

  let stepX: number, stepY: number;
  let sideDistX: number, sideDistY: number;

  if (cos < 0) {
    stepX = -1;
    sideDistX = (px - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - px) * deltaDistX;
  }
  if (sin < 0) {
    stepY = -1;
    sideDistY = (py - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - py) * deltaDistY;
  }

  let currentMapX = mapX;
  let currentMapY = mapY;
  let hit = 0;
  let side: 'ns' | 'ew' = 'ns';

  while (hit === 0) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      currentMapX += stepX;
      side = 'ew';
    } else {
      sideDistY += deltaDistY;
      currentMapY += stepY;
      side = 'ns';
    }
    const cell = getCell(currentMapX, currentMapY);
    if (cell > 0 && cell !== SPAWN) {
      hit = cell;
      break;
    }
    const dist = side === 'ns'
      ? (currentMapY - py + (1 - stepY) / 2) / sin
      : (currentMapX - px + (1 - stepX) / 2) / cos;
    if (Math.abs(dist) > maxDist) break;
  }

  let perpDist: number;
  if (side === 'ns') {
    perpDist = (currentMapY - py + (1 - stepY) / 2) / sin;
  } else {
    perpDist = (currentMapX - px + (1 - stepX) / 2) / cos;
  }
  if (perpDist <= 0) perpDist = 0.001;
  const dist = Math.abs(perpDist);
  // Correction fisheye : distance perpendiculaire au plan de la caméra (comme le C Pokémon)
  const perpDistance = dist * Math.cos(rayAngle - playerAngle);
  const perpDistanceClamped = Math.max(perpDistance, 0.0001);
  const hitX = px + dist * cos;
  const hitY = py + dist * sin;
  const wallU = side === 'ns' ? hitX - Math.floor(hitX) : hitY - Math.floor(hitY);
  const wallUClamped = wallU < 0 ? wallU + 1 : wallU >= 1 ? wallU - 1 : wallU;

  return {
    distance: dist,
    perpDistance: perpDistanceClamped,
    wallType: hit as Cell,
    side,
    wallU: wallUClamped,
  };
}

/** Nombre de rayons (colonnes) pour le raycasting. Moins = plus fluide, plus = plus précis. */
export const RAY_COUNT = 480;

export function castAllRays(
  player: Player,
  rayCount: number = RAY_COUNT,
  maxDist: number = 20
): RayHit[] {
  const halfFov = FOV / 2;
  const rays: RayHit[] = [];
  for (let col = 0; col < rayCount; col++) {
    const rayAngle = player.angle - halfFov + (col / rayCount) * FOV;
    rays.push(castRay(player.x, player.y, rayAngle, player.angle, maxDist));
  }
  return rays;
}
