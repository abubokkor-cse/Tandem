// Photos are processed on the device: resized, re-encoded (which drops EXIF, including GPS),
// and checked for darkness and blur before anything leaves the phone.

import type { PhotoMeta } from '../core/record';
import type { PhotoRole } from '../core/protocol';

export interface ProcessedPhoto {
  meta: PhotoMeta;
  /** Base64 JPEG (no data: prefix) sent to the AI. */
  data: string;
  /** Object URL for display while the check is open. */
  preview: string;
}

async function load(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

function canvasOf(img: ImageBitmap, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Mean luminance and variance of the Laplacian (a standard blur measure) on a 256 px copy. */
function measure(img: ImageBitmap) {
  const c = canvasOf(img, 256);
  const { data, width: w, height: h } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
  const g = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    sum += g[i];
  }
  let lapSum = 0, lapSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = g[i - w] + g[i + w] + g[i - 1] + g[i + 1] - 4 * g[i];
      lapSum += l;
      lapSq += l * l;
      n++;
    }
  }
  const mean = lapSum / n;
  return { brightness: sum / (w * h), sharpness: lapSq / n - mean * mean };
}

/** 64-bit difference hash: survives resizing and re-encoding, so a reused photo is recognised. */
function dHash(img: ImageBitmap): string {
  const c = document.createElement('canvas');
  c.width = 9;
  c.height = 8;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, 9, 8);
  const d = ctx.getImageData(0, 0, 9, 8).data;
  const g = (x: number, y: number) => {
    const i = (y * 9 + x) * 4;
    return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  };
  let hex = '';
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) byte = (byte << 1) | (g(x, y) > g(x + 1, y) ? 1 : 0);
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export async function processPhoto(file: Blob, role: PhotoRole): Promise<ProcessedPhoto> {
  const img = await load(file);
  const { brightness, sharpness } = measure(img);
  const hash = dHash(img);
  const full = canvasOf(img, 1280);
  const thumb = canvasOf(img, 360);
  const blob = await new Promise<Blob>((res) => full.toBlob((b) => res(b!), 'image/jpeg', 0.85));
  const data = await blobToBase64(blob);
  const issues: string[] = [];
  if (brightness < 45) issues.push('Very dark. Try facing away from the sun or wait for more light.');
  if (brightness > 225) issues.push('Very bright or washed out.');
  if (sharpness < 40) issues.push('Looks blurry. Hold still, tap to focus, and retake.');
  const meta: PhotoMeta = {
    role,
    width: full.width,
    height: full.height,
    brightness: Math.round(brightness),
    sharpness: Math.round(sharpness),
    hash,
    issues,
    thumb: thumb.toDataURL('image/jpeg', 0.7),
  };
  img.close();
  return { meta, data, preview: URL.createObjectURL(blob) };
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(b);
  });
}
