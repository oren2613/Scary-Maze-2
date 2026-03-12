/**
 * Carte 1D pour le raycasting.
 * 0 = vide, 1 = mur, SPAWN = position de départ du joueur.
 */
export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 20;

export const WALL = 1;
export const SPAWN = 4; // case de départ (traité comme vide pour déplacement/raycast)

export type Cell = number;

export const map: Cell[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,4,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,0,1,0,1,1,0,1,0,1,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1],
  [1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];


export function getCell(mapX: number, mapY: number): Cell {
  const x = Math.floor(mapX);
  const y = Math.floor(mapY);
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return 1;
  return map[y][x];
}

export function isWall(mapX: number, mapY: number): boolean {
  const cell = getCell(mapX, mapY);
  return cell > 0 && cell !== SPAWN;
}

/** Position de départ du joueur (centre de la case SPAWN). */
export function getSpawnPosition(): { x: number; y: number } {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (map[y][x] === SPAWN) return { x: x + 0.5, y: y + 0.5 };
    }
  }
  return { x: 1.5, y: 1.5 };
}
