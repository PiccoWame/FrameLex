import type { ColorSwatch, ImageMetadata } from '../types/prompt';

const STANDARD_RATIOS: Array<{ label: string; value: number }> = [
  { label: '21:9', value: 21 / 9 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:2', value: 3 / 2 },
  { label: '4:3', value: 4 / 3 },
  { label: '5:4', value: 5 / 4 },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '3:4', value: 3 / 4 },
  { label: '2:3', value: 2 / 3 },
  { label: '9:16', value: 9 / 16 },
];

export function computeAspectRatioLabel(width: number, height: number): string {
  if (!width || !height) return '1:1';
  const ratio = width / height;
  let best = STANDARD_RATIOS[0];
  let minDiff = Math.abs(ratio - best.value);
  for (const candidate of STANDARD_RATIOS) {
    const diff = Math.abs(ratio - candidate.value);
    if (diff < minDiff) {
      minDiff = diff;
      best = candidate;
    }
  }
  return best.label;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function extractDominantColors(img: HTMLImageElement, count = 8): ColorSwatch[] {
  const size = 80;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<string, { rSum: number; gSum: number; bSum: number; count: number }>();
  let totalPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.floor(r / 18)}-${Math.floor(g / 18)}-${Math.floor(b / 18)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.rSum += r;
      existing.gSum += g;
      existing.bSum += b;
      existing.count += 1;
    } else {
      buckets.set(key, { rSum: r, gSum: g, bSum: b, count: 1 });
    }
    totalPixels += 1;
  }

  if (totalPixels === 0) return [];

  const sorted = Array.from(buckets.values())
    .map((b) => ({
      rgb: [b.rSum / b.count, b.gSum / b.count, b.bSum / b.count] as [number, number, number],
      count: b.count,
    }))
    .sort((a, b) => b.count - a.count);

  const selected: Array<{ rgb: [number, number, number]; count: number }> = [];
  for (const candidate of sorted) {
    const tooClose = selected.some((item) => colorDistance(item.rgb, candidate.rgb) < 28);
    if (!tooClose) {
      selected.push(candidate);
    }
    if (selected.length >= count) break;
  }

  // Fill remaining slots if image is nearly monochromatic
  if (selected.length < count) {
    for (const candidate of sorted) {
      if (!selected.includes(candidate)) {
        selected.push(candidate);
      }
      if (selected.length >= count) break;
    }
  }

  const selectedTotal = selected.reduce((sum, s) => sum + s.count, 0) || 1;
  return selected.map((s) => ({
    hex: rgbToHex(s.rgb[0], s.rgb[1], s.rgb[2]),
    percentage: Math.max(1, Math.round((s.count / selectedTotal) * 100)),
  }));
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image.'));
    img.src = src;
  });
}

function renderResizedDataUrl(
  img: HTMLImageElement,
  maxDimension: number,
  mimeType: string,
  quality: number
): { dataUrl: string; base64: string; mime: string } {
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
  const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable.');
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const outputMime = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(outputMime, quality);
  const base64 = dataUrl.split(',')[1] || '';
  return { dataUrl, base64, mime: outputMime };
}

export async function processDataUrl(
  dataUrl: string,
  name: string,
  sizeBytes: number,
  originalMime: string
): Promise<{ image: ImageMetadata; colors: ColorSwatch[] }> {
  const img = await loadImageElement(dataUrl);
  const colors = extractDominantColors(img, 8);
  const { base64, mime } = renderResizedDataUrl(img, 1600, originalMime, 0.92);
  const thumb = renderResizedDataUrl(img, 260, 'image/jpeg', 0.78);

  return {
    image: {
      name,
      width: img.naturalWidth,
      height: img.naturalHeight,
      aspectRatioLabel: computeAspectRatioLabel(img.naturalWidth, img.naturalHeight),
      mimeType: mime,
      sizeBytes,
      previewUrl: dataUrl,
      thumbnailUrl: thumb.dataUrl,
      base64,
    },
    colors,
  };
}

export async function processImageFile(
  file: File
): Promise<{ image: ImageMetadata; colors: ColorSwatch[] }> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'}`);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  return processDataUrl(dataUrl, file.name, file.size, file.type);
}

export async function processBundledImage(
  url: string,
  name: string
): Promise<{ image: ImageMetadata; colors: ColorSwatch[] }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Could not load sample image.');
  }
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image blob.'));
    reader.readAsDataURL(blob);
  });

  return processDataUrl(dataUrl, name, blob.size, blob.type || 'image/jpeg');
}
