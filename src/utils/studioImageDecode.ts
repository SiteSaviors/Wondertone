export const STUDIO_DECODE_MAX_EDGE = 2048;
export const STUDIO_DECODE_JPEG_QUALITY = 0.82;

export type StudioDecodeSize = {
  width: number;
  height: number;
  scaled: boolean;
};

export type StudioDecodeResult = StudioDecodeSize & {
  dataUrl: string;
};

export type StudioDecodeOptions = {
  width?: number;
  height?: number;
  maxEdge?: number;
};

export function computeStudioDecodeSize(
  width: number,
  height: number,
  maxEdge = STUDIO_DECODE_MAX_EDGE
): StudioDecodeSize {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0, scaled: false };
  }
  const edge = Math.max(width, height);
  if (edge <= maxEdge) {
    return { width, height, scaled: false };
  }
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

const probeDataUrlDimensions = async (dataUrl: string): Promise<{ width: number; height: number }> => {
  if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const bitmap = await createImageBitmap(blob);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return dims;
    } catch {
      // Fall through to HTMLImageElement.
    }
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Unable to decode image for studio'));
    image.src = dataUrl;
  });
};

const canvasToJpeg = (canvas: HTMLCanvasElement | OffscreenCanvas, quality: number): Promise<string> => {
  if ('toDataURL' in canvas && typeof canvas.toDataURL === 'function') {
    return Promise.resolve(canvas.toDataURL('image/jpeg', quality));
  }
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: 'image/jpeg', quality }).then((blob) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    });
  }
  return Promise.reject(new Error('No canvas encoder available'));
};

const resizeToJpeg = async (
  dataUrl: string,
  width: number,
  height: number,
  quality: number
): Promise<string> => {
  if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
    });
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('OffscreenCanvas context unavailable');
        }
        context.drawImage(bitmap, 0, 0, width, height);
        return await canvasToJpeg(canvas, quality);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas context unavailable');
      }
      context.drawImage(bitmap, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', quality);
    } finally {
      bitmap.close?.();
    }
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = () => reject(new Error('Unable to decode image for studio'));
    image.src = dataUrl;
  });
};

/**
 * Bound a memorial / studio photo so a phone does not decode native 12–48MP pixels.
 * Fail-open: if decode APIs are missing, return the original URL unchanged.
 */
export async function downscaleDataUrlForStudio(
  dataUrl: string,
  options: StudioDecodeOptions = {}
): Promise<StudioDecodeResult> {
  const maxEdge = options.maxEdge ?? STUDIO_DECODE_MAX_EDGE;
  try {
    const known =
      options.width && options.height
        ? { width: options.width, height: options.height }
        : await probeDataUrlDimensions(dataUrl);
    const next = computeStudioDecodeSize(known.width, known.height, maxEdge);
    if (!next.scaled) {
      return { dataUrl, width: known.width, height: known.height, scaled: false };
    }
    const resized = await resizeToJpeg(dataUrl, next.width, next.height, STUDIO_DECODE_JPEG_QUALITY);
    return { dataUrl: resized, width: next.width, height: next.height, scaled: true };
  } catch {
    return { dataUrl, width: options.width ?? 0, height: options.height ?? 0, scaled: false };
  }
}
