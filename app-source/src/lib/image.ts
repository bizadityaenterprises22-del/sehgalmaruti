/*
  Shrink a photograph before it leaves the phone. A 12 MP JPEG is 4-6 MB; the OCR engines
  and the ledger want a 1600 px long side at 82 % - about 250-400 KB - and nothing is
  lost that a plate or a receipt needs. Falls back to the original blob on any failure
  (an un-shrunk upload is better than no upload).
*/

export async function compressImage(blob: Blob, maxPx = 1600, quality = 0.82): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return blob;
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
    if (scale === 1 && blob.type === "image/jpeg" && blob.size < 900_000) {
      bmp.close();
      return blob;
    }
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return blob;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return out && out.size > 0 ? out : blob;
  } catch {
    return blob;
  }
}

export function base64ToBlob(b64: string, mime = "image/jpeg"): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Object URL for a preview thumbnail; caller revokes. */
export function previewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
