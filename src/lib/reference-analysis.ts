import type { DesignReference, ReferenceKind, ReferenceAnalysis } from "./types";

const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
const luminance = (r: number, g: number, b: number) => {
  const values = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
};

function palette(data: Uint8ClampedArray, width: number, height: number): Pick<ReferenceAnalysis, "averageColor" | "dominantColors" | "luminance" | "contrast"> {
  const histogram = new Map<string, number>();
  let totalR = 0, totalG = 0, totalB = 0, samples = 0, minLum = 1, maxLum = 0;
  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 20000)));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 32) continue;
      const r = data[index], g = data[index + 1], b = data[index + 2];
      totalR += r; totalG += g; totalB += b; samples += 1;
      const lum = luminance(r, g, b); minLum = Math.min(minLum, lum); maxLum = Math.max(maxLum, lum);
      const qr = Math.min(224, Math.round(r / 32) * 32);
      const qg = Math.min(224, Math.round(g / 32) * 32);
      const qb = Math.min(224, Math.round(b / 32) * 32);
      const key = rgbToHex(qr, qg, qb);
      histogram.set(key, (histogram.get(key) || 0) + 1);
    }
  }
  const averageColor = samples ? rgbToHex(totalR / samples, totalG / samples, totalB / samples) : "#808080";
  const dominantColors = [...histogram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([color]) => color);
  const averageLum = samples ? luminance(totalR / samples, totalG / samples, totalB / samples) : 0.5;
  const spread = maxLum - minLum;
  return { averageColor, dominantColors, luminance: Number(averageLum.toFixed(4)), contrast: spread < 0.25 ? "low" : spread < 0.58 ? "medium" : "high" };
}

async function bitmapToReference(file: File, kind: ReferenceKind, maxDimension: number, quality: number): Promise<DesignReference> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is unavailable in this browser.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, width, height);
  const colors = palette(pixels.data, width, height);
  const dataUrl = canvas.toDataURL("image/webp", quality);
  return {
    id: `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: file.name.replace(/\.[^.]+$/, "") || `${kind} reference`,
    kind,
    mimeType: "image/webp",
    dataUrl,
    createdAt: new Date().toISOString(),
    analysis: { width, height, aspectRatio: Number((width / height).toFixed(4)), ...colors },
  };
}

/** Ingests and compresses a reference locally. No image bytes leave the browser. */
export async function analyzeReferenceFile(file: File, kind: ReferenceKind = "screenshot"): Promise<DesignReference> {
  if (!file.type.startsWith("image/")) throw new Error("Reference must be an image file.");
  if (file.size > 25 * 1024 * 1024) throw new Error("Reference image is larger than 25 MB.");
  let reference = await bitmapToReference(file, kind, 1400, 0.8);
  if (reference.dataUrl.length > 1_900_000) reference = await bitmapToReference(file, kind, 900, 0.66);
  if (reference.dataUrl.length > 2_400_000) throw new Error("Compressed reference is still too large for reliable browser project storage.");
  return reference;
}

function saturation(hex: string) {
  const values = hex.slice(1).match(/.{2}/g)?.map((part) => parseInt(part, 16) / 255) || [0, 0, 0];
  return Math.max(...values) - Math.min(...values);
}

export function suggestedAccent(reference: DesignReference) {
  return [...reference.analysis.dominantColors].sort((a, b) => saturation(b) - saturation(a))[0] || reference.analysis.averageColor;
}

export function referenceSummary(reference: DesignReference) {
  const theme = reference.analysis.luminance < 0.38 ? "dark" : reference.analysis.luminance > 0.68 ? "light" : "mixed";
  return `${reference.kind} ${reference.analysis.width}×${reference.analysis.height}; ${theme} visual weight; ${reference.analysis.contrast} contrast; palette ${reference.analysis.dominantColors.join(", ")}.`;
}
