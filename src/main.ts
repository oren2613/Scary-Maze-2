/**
 * Point d'entrée : boucle de jeu, contrôles (ZQSD + souris), raycasting.
 */
import { Player } from './game/player.js';
import { isWall, getSpawnPosition } from './game/map.js';
import { castAllRays, RAY_COUNT } from './game/raycaster.js';
import { render, loadWallTexture } from './game/renderer.js';
import { renderMinimap, MINIMAP_SIZE, MINIMAP_MARGIN } from './game/minimap.js';
import { getRats, spawnRatAt, updateRats } from './game/rats.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!; // opaque = meilleures perfs

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

const spawn = getSpawnPosition();
const player = new Player(spawn.x, spawn.y, 0);

const RAT_SPAWN_INTERVAL_MS = 10000;
let lastRatSpawnTime = -10000;
let lastFrameTime = 0;
let playingVideo = false;

const videoOverlay = document.getElementById('video-overlay') as HTMLDivElement;
const videoCutscene = document.getElementById('video-cutscene') as HTMLVideoElement;
const videoSoundHint = document.getElementById('video-sound-hint') as HTMLDivElement;

videoCutscene.src = '/.mp4';
videoCutscene.playsInline = true;
videoCutscene.addEventListener('ended', () => {
  playingVideo = false;
  videoCutscene.pause();
  videoCutscene.currentTime = 0;
  videoSoundHint.classList.add('hidden');
});
videoCutscene.addEventListener('error', () => {
  console.error('Erreur chargement vidéo. Place le fichier .mp4 dans public/ (en tant que .mp4 ou video.mp4)');
});

function unmuteVideo(): void {
  if (!playingVideo) return;
  if (videoCutscene.muted) {
    videoCutscene.muted = false;
    videoSoundHint.classList.add('hidden');
    videoCutscene.play().catch(() => {}); // certain mobile require play() après unmute
  }
}

canvas.addEventListener('click', () => {
  if (playingVideo) unmuteVideo();
});
canvas.addEventListener('touchstart', () => {
  if (playingVideo) unmuteVideo();
}, { passive: true });

function playCutscene(): void {
  playingVideo = true;
  videoCutscene.currentTime = 0;
  videoSoundHint.classList.add('hidden');
  videoCutscene.muted = false;
  videoCutscene.play().catch(() => {
    videoCutscene.muted = true;
    videoSoundHint.classList.remove('hidden');
    return videoCutscene.play();
  }).catch((e) => {
    console.error('Lecture vidéo impossible:', e);
    playingVideo = false;
  });
}

const keys: Record<string, boolean> = {};
function onKey(e: KeyboardEvent, down: boolean): void {
  keys[e.key.toLowerCase()] = down;
  e.preventDefault();
}

let mouseSensitivity = 0.0032;
let pointerLocked = false;
let mouseMoveForward = false; // clic gauche maintenu = avancer

// Contrôles tactiles (mobile) — tout l'écran = avancer, glisser = tourner
let touchMoveForward = false;
const forwardTouchIds = new Set<number>();
let touchLookId: number | null = null;
let lastTouchX = 0;
const TOUCH_LOOK_SENSITIVITY = 0.018;

canvas.addEventListener('click', () => {
  if (typeof canvas.requestPointerLock === 'function') {
    canvas.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked) mouseMoveForward = false;
});

document.addEventListener('keydown', (e) => onKey(e, true));
document.addEventListener('keyup', (e) => onKey(e, false));

// ——— Touch (mobile) ———
function getTouchLookSensitivity(): number {
  return TOUCH_LOOK_SENSITIVITY * (window.innerWidth / 600);
}

// ——— Minimap déplaçable ———
let minimapX: number | null = null;
let minimapY: number | null = null;
let minimapDragTouchId: number | null = null;
let minimapDragMouse = false;
let lastMinimapDragClientX = 0;
let lastMinimapDragClientY = 0;

function getMinimapRect(): { x: number; y: number; w: number; h: number } {
  const w = canvas.width;
  const h = canvas.height;
  const x = minimapX ?? w - MINIMAP_SIZE - MINIMAP_MARGIN;
  const y = minimapY ?? h - MINIMAP_SIZE - MINIMAP_MARGIN;
  return { x, y, w: MINIMAP_SIZE, h: MINIMAP_SIZE };
}

function clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function isInsideMinimap(clientX: number, clientY: number): boolean {
  const { x, y, w, h } = getMinimapRect();
  const p = clientToCanvas(clientX, clientY);
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}

function startMinimapDrag(clientX: number, clientY: number): void {
  if (minimapX === null || minimapY === null) {
    minimapX = canvas.width - MINIMAP_SIZE - MINIMAP_MARGIN;
    minimapY = canvas.height - MINIMAP_SIZE - MINIMAP_MARGIN;
  }
  lastMinimapDragClientX = clientX;
  lastMinimapDragClientY = clientY;
}

function moveMinimapBy(clientX: number, clientY: number): void {
  const dx = clientX - lastMinimapDragClientX;
  const dy = clientY - lastMinimapDragClientY;
  lastMinimapDragClientX = clientX;
  lastMinimapDragClientY = clientY;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  minimapX = (minimapX ?? canvas.width - MINIMAP_SIZE - MINIMAP_MARGIN) + dx * scaleX;
  minimapY = (minimapY ?? canvas.height - MINIMAP_SIZE - MINIMAP_MARGIN) + dy * scaleY;
  minimapX = Math.max(0, Math.min(canvas.width - MINIMAP_SIZE, minimapX));
  minimapY = Math.max(0, Math.min(canvas.height - MINIMAP_SIZE, minimapY));
}

document.addEventListener('touchstart', (e) => {
  if (playingVideo) {
    unmuteVideo();
    e.preventDefault();
    return;
  }
  const t = e.changedTouches[0];
  if (!t) return;
  e.preventDefault();
  if (isInsideMinimap(t.clientX, t.clientY)) {
    minimapDragTouchId = t.identifier;
    startMinimapDrag(t.clientX, t.clientY);
    return;
  }
  forwardTouchIds.add(t.identifier);
  touchMoveForward = true;
  if (touchLookId === null) {
    touchLookId = t.identifier;
    lastTouchX = t.clientX;
  }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  if (minimapDragTouchId !== null) {
    const t = Array.from(e.changedTouches).find((x) => x.identifier === minimapDragTouchId)
      ?? Array.from(e.touches).find((x) => x.identifier === minimapDragTouchId);
    if (t) {
      moveMinimapBy(t.clientX, t.clientY);
      e.preventDefault();
    }
    return;
  }
  if (touchLookId === null) return;
  const t = Array.from(e.changedTouches).find((x) => x.identifier === touchLookId)
    ?? Array.from(e.touches).find((x) => x.identifier === touchLookId);
  if (t) {
    const dx = t.clientX - lastTouchX;
    player.angle += dx * getTouchLookSensitivity();
    lastTouchX = t.clientX;
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === minimapDragTouchId) minimapDragTouchId = null;
    forwardTouchIds.delete(t.identifier);
    touchMoveForward = forwardTouchIds.size > 0;
    if (t.identifier === touchLookId) touchLookId = null;
  }
});

document.addEventListener('touchcancel', () => {
  touchLookId = null;
  forwardTouchIds.clear();
  touchMoveForward = false;
  minimapDragTouchId = null;
});

document.addEventListener('mousedown', (e) => {
  if (e.button === 0 && e.target === canvas && isInsideMinimap(e.clientX, e.clientY)) {
    minimapDragMouse = true;
    startMinimapDrag(e.clientX, e.clientY);
    return;
  }
  if (e.button === 0) mouseMoveForward = true;
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    minimapDragMouse = false;
    mouseMoveForward = false;
  }
});
document.addEventListener('mousemove', (e) => {
  if (minimapDragMouse) {
    moveMinimapBy(e.clientX, e.clientY);
    return;
  }
  if (!pointerLocked) return;
  player.angle += e.movementX * mouseSensitivity;
});

const COLLISION_MARGIN = 0.4;

function collision(mapX: number, mapY: number): boolean {
  return (
    isWall(mapX - COLLISION_MARGIN, mapY - COLLISION_MARGIN) ||
    isWall(mapX + COLLISION_MARGIN, mapY - COLLISION_MARGIN) ||
    isWall(mapX - COLLISION_MARGIN, mapY + COLLISION_MARGIN) ||
    isWall(mapX + COLLISION_MARGIN, mapY + COLLISION_MARGIN)
  );
}

const DT_CAP_SEC = 0.05; // évite les sauts quand l'onglet reprend (max 20 "steps" de rattrapage)

function update(now: number): void {
  let dtSec = lastFrameTime ? (now - lastFrameTime) / 1000 : 0.016;
  if (dtSec > DT_CAP_SEC) dtSec = DT_CAP_SEC;
  lastFrameTime = now;

  const block = (mx: number, my: number) => collision(mx, my);
  if (keys['z'] || mouseMoveForward || touchMoveForward) player.moveForward(block, dtSec);
  if (keys['s']) player.moveBackward(block, dtSec);
  if (keys['q']) player.strafeLeft(block, dtSec);
  if (keys['d']) player.strafeRight(block, dtSec);
  if (keys['arrowleft']) player.rotateLeft(dtSec);
  if (keys['arrowright']) player.rotateRight(dtSec);
  if (now - lastRatSpawnTime >= RAT_SPAWN_INTERVAL_MS) {
    spawnRatAt(player.x, player.y, player.angle);
    lastRatSpawnTime = now;
  }
  updateRats(dtSec, player.x, player.y, player.angle);
}

function gameLoop(now: number = 0): void {
  if (playingVideo) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (videoCutscene.readyState >= 2) {
      ctx.drawImage(videoCutscene, 0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(gameLoop);
    return;
  }
  update(now);
  const rays = castAllRays(player, RAY_COUNT, 22);
  render(ctx, rays, canvas.width, canvas.height, player.angle, player.x, player.y, getRats());
  renderMinimap(ctx, player.x, player.y, player.angle, canvas.width, canvas.height, minimapX ?? undefined, minimapY ?? undefined);
  requestAnimationFrame(gameLoop);
}

loadWallTexture();
resize();
window.addEventListener('resize', resize);
setTimeout(playCutscene, 40000);
requestAnimationFrame(gameLoop);
