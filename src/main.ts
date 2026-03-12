/**
 * Point d'entrée : boucle de jeu, contrôles (ZQSD + souris), raycasting.
 */
import { Player } from './game/player.js';
import { isWall, getSpawnPosition } from './game/map.js';
import { castAllRays, RAY_COUNT } from './game/raycaster.js';
import { render, loadWallTexture } from './game/renderer.js';
import { renderMinimap } from './game/minimap.js';
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
  videoOverlay.classList.remove('visible');
  playingVideo = false;
  videoCutscene.pause();
  videoCutscene.currentTime = 0;
  videoSoundHint.classList.add('hidden');
});
videoCutscene.addEventListener('error', () => {
  console.error('Erreur chargement vidéo. Place le fichier .mp4 dans public/ (en tant que .mp4 ou video.mp4)');
});

videoOverlay.addEventListener('click', () => {
  if (!playingVideo) return;
  if (videoCutscene.muted) {
    videoCutscene.muted = false;
    videoSoundHint.classList.add('hidden');
  }
});

function playCutscene(): void {
  playingVideo = true;
  videoOverlay.classList.add('visible');
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
    videoOverlay.classList.remove('visible');
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

canvas.addEventListener('click', () => {
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked) mouseMoveForward = false;
});

document.addEventListener('keydown', (e) => onKey(e, true));
document.addEventListener('keyup', (e) => onKey(e, false));

document.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouseMoveForward = true;
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseMoveForward = false;
});

document.addEventListener('mousemove', (e) => {
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
  if (keys['z'] || mouseMoveForward) player.moveForward(block, dtSec);
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
    requestAnimationFrame(gameLoop);
    return;
  }
  update(now);
  const rays = castAllRays(player, RAY_COUNT, 22);
  render(ctx, rays, canvas.width, canvas.height, player.angle, player.x, player.y, getRats());
  renderMinimap(ctx, player.x, player.y, player.angle, canvas.width, canvas.height);
  requestAnimationFrame(gameLoop);
}

loadWallTexture();
resize();
window.addEventListener('resize', resize);
setTimeout(playCutscene, 80000);
requestAnimationFrame(gameLoop);
