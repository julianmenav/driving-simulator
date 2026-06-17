import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';

/**
 * Procedurally generated radial-gradient textures — the "function" behind every
 * light glow in the scene. Generated once on first use and cached (shared by
 * every bulb), so thousands of windows and dozens of lamps cost two textures.
 *
 * Two flavours:
 *  - `haloTexture`: white core fading to fully transparent — for additive halos
 *    (lamp/streetlight glows, the moon) and ground light pools.
 *  - `windowTexture`: an opaque pane, bright core easing to a darker rim with a
 *    dark frame border. Tinted per-window via instance colour; the brightness
 *    falloff reads as a soft interior glow without any transparency/blending.
 */

let haloCache: CanvasTexture | null = null;
let windowCache: CanvasTexture | null = null;

function makeContext(size: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

export function haloTexture(): Texture {
  if (haloCache) return haloCache;
  const size = 128;
  const ctx = makeContext(size);
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  haloCache = new CanvasTexture(ctx.canvas);
  haloCache.colorSpace = SRGBColorSpace;
  return haloCache;
}

export function windowTexture(): Texture {
  if (windowCache) return windowCache;
  const size = 64;
  const ctx = makeContext(size);
  // Bright pane, brightest a little above centre, easing to a dimmer rim.
  const gradient = ctx.createRadialGradient(size * 0.5, size * 0.42, 1, size * 0.5, size * 0.5, size * 0.72);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.7, 'rgba(200,200,200,1)');
  gradient.addColorStop(1, 'rgba(130,130,130,1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  // Dark frame around the pane so windows read as windows, not flat patches.
  ctx.strokeStyle = 'rgba(18,20,26,1)';
  ctx.lineWidth = size * 0.14;
  ctx.strokeRect(0, 0, size, size);
  windowCache = new CanvasTexture(ctx.canvas);
  windowCache.colorSpace = SRGBColorSpace;
  return windowCache;
}
