const DISPLAY_MAX_EDGE = 1280;
const DISPLAY_JPEG_QUALITY = 76;

/**
 * Lower-resolution display JPEG for the public preview bucket.
 * Preview is display-only. This is not the product file.
 */
export async function createDisplayPreview(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const { Image } = await import('https://deno.land/x/imagescript@1.2.15/mod.ts');
  const image = await Image.decode(new Uint8Array(buffer));
  const maxEdge = Math.max(image.width, image.height);
  if (maxEdge > DISPLAY_MAX_EDGE) {
    const scale = DISPLAY_MAX_EDGE / maxEdge;
    image.resize(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
  }
  const output = await image.encodeJPEG(DISPLAY_JPEG_QUALITY);
  return output.buffer;
}

export function toPublicDisplayRef(bucket: string, path: string): { bucket: string; path: string } {
  if (bucket === 'preview-cache-premium') {
    return { bucket: 'preview-cache-public', path };
  }
  return { bucket, path };
}
