/**
 * Joueur : position, direction (angle), et déplacements.
 * Vitesses en unités par seconde pour un mouvement fluide et indépendant du framerate.
 */
export const MOVE_SPEED = 3.2;   // unités par seconde
export const ROT_SPEED = 1.6;    // radians par seconde (~92°/s)
export const FOV = Math.PI / 3;  // 60°

export class Player {
  x: number;
  y: number;
  angle: number; // en radians, 0 = droite

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    this.angle = angle;
  }

  moveForward(map: (mx: number, my: number) => boolean, dtSec: number): void {
    const step = MOVE_SPEED * dtSec;
    const nx = this.x + Math.cos(this.angle) * step;
    const ny = this.y + Math.sin(this.angle) * step;
    if (!map(nx, this.y)) this.x = nx;
    if (!map(this.x, ny)) this.y = ny;
  }

  moveBackward(map: (mx: number, my: number) => boolean, dtSec: number): void {
    const step = MOVE_SPEED * dtSec;
    const nx = this.x - Math.cos(this.angle) * step;
    const ny = this.y - Math.sin(this.angle) * step;
    if (!map(nx, this.y)) this.x = nx;
    if (!map(this.x, ny)) this.y = ny;
  }

  strafeLeft(map: (mx: number, my: number) => boolean, dtSec: number): void {
    const step = MOVE_SPEED * dtSec;
    const a = this.angle - Math.PI / 2;
    const nx = this.x + Math.cos(a) * step;
    const ny = this.y + Math.sin(a) * step;
    if (!map(nx, this.y)) this.x = nx;
    if (!map(this.x, ny)) this.y = ny;
  }

  strafeRight(map: (mx: number, my: number) => boolean, dtSec: number): void {
    const step = MOVE_SPEED * dtSec;
    const a = this.angle + Math.PI / 2;
    const nx = this.x + Math.cos(a) * step;
    const ny = this.y + Math.sin(a) * step;
    if (!map(nx, this.y)) this.x = nx;
    if (!map(this.x, ny)) this.y = ny;
  }

  rotateLeft(dtSec: number): void {
    this.angle -= ROT_SPEED * dtSec;
  }

  rotateRight(dtSec: number): void {
    this.angle += ROT_SPEED * dtSec;
  }
}
