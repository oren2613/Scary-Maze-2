/**
 * Rats qui apparaissent toutes les 10 secondes, courent le long du mur et disparaissent au loin.
 */
import { getCell, SPAWN } from './map.js';

const RAT_MARGIN = 0.08;
const RAT_SPEED = 2;
const DESPAWN_DISTANCE = 14;

export interface Rat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** +1 = vers la droite à l'écran, -1 = vers la gauche (par rapport à la caméra). */
  direction: number;
}

const rats: Rat[] = [];
const MAX_RATS = 12;

function isWallCell(mapX: number, mapY: number): boolean {
  const cell = getCell(mapX, mapY);
  return cell > 0 && cell !== SPAWN;
}

function ratCollision(x: number, y: number): boolean {
  return (
    isWallCell(x - RAT_MARGIN, y - RAT_MARGIN) ||
    isWallCell(x + RAT_MARGIN, y - RAT_MARGIN) ||
    isWallCell(x - RAT_MARGIN, y + RAT_MARGIN) ||
    isWallCell(x + RAT_MARGIN, y + RAT_MARGIN)
  );
}

/** Vitesse perpendiculaire à la caméra : le rat se déplace toujours horizontalement à l'écran (gauche/droite). */
function velocityHorizontalToCamera(playerAngle: number, direction: number): { vx: number; vy: number } {
  return {
    vx: direction * -Math.sin(playerAngle) * RAT_SPEED,
    vy: direction * Math.cos(playerAngle) * RAT_SPEED,
  };
}

/** Spawn devant le joueur (dans le champ de vision), à bonne distance. */
function spawnPositionInFront(px: number, py: number, playerAngle: number): { x: number; y: number } {
  const dist = 3;
  let x = px + Math.cos(playerAngle) * dist;
  let y = py + Math.sin(playerAngle) * dist;
  if (ratCollision(x, y)) {
    x = px + Math.cos(playerAngle) * 2;
    y = py + Math.sin(playerAngle) * 2;
  }
  return { x, y };
}

export function getRats(): Rat[] {
  return rats;
}

export function spawnRatAt(px: number, py: number, playerAngle: number): void {
  if (rats.length >= MAX_RATS) rats.shift();
  const pos = spawnPositionInFront(px, py, playerAngle);
  const direction = Math.random() < 0.5 ? -1 : 1;
  const vel = velocityHorizontalToCamera(playerAngle, direction);
  rats.push({ x: pos.x, y: pos.y, vx: vel.vx, vy: vel.vy, direction });
}

export function updateRats(dtSec: number, playerX: number, playerY: number, playerAngle: number): void {
  for (let i = rats.length - 1; i >= 0; i--) {
    const r = rats[i];
    const dx = r.x - playerX;
    const dy = r.y - playerY;
    if (Math.sqrt(dx * dx + dy * dy) > DESPAWN_DISTANCE) {
      rats.splice(i, 1);
      continue;
    }
    const vel = velocityHorizontalToCamera(playerAngle, r.direction);
    r.vx = vel.vx;
    r.vy = vel.vy;
    const nx = r.x + r.vx * dtSec;
    const ny = r.y + r.vy * dtSec;
    const hitX = ratCollision(nx, r.y);
    const hitY = ratCollision(r.x, ny);
    if (hitX || hitY) {
      rats.splice(i, 1);
    } else {
      r.x = nx;
      r.y = ny;
    }
  }
}
