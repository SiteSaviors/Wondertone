import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

interface UploadOptions {
  cacheControl?: string;
  contentType?: string;
}

export interface StorageUploadResult {
  storagePath: string;
  /** Locator only — never treat as entitlement or a fetchable clean-art URL. */
  publicUrl: string;
  isPublicBucket: boolean;
  bucket: string;
}

export interface SignedUrlResult {
  signedUrl: string;
  expiresAt: number;
}

export class PreviewStorageClient {
  private readonly publicBucket: string;
  private readonly premiumBucket: string;

  constructor(
    private readonly supabase: SupabaseClient,
    bucket: string
  ) {
    // Dual-bucket system: public for watermarked, premium for clean
    this.publicBucket = `${bucket}-public`;
    this.premiumBucket = `${bucket}-premium`;
  }

  /**
   * Upload to appropriate bucket based on watermark requirement
   * @param requiresWatermark - If true, uploads to public bucket; if false, uploads to premium bucket
   */
  async uploadFromUrl(sourceUrl: string, storagePath: string, options: UploadOptions = {}, requiresWatermark = true): Promise<StorageUploadResult> {
    let arrayBuffer: ArrayBuffer;
    let contentType = options.contentType ?? 'image/jpeg';

    if (sourceUrl.startsWith('data:image/')) {
      const [header, data] = sourceUrl.split(',');
      if (!data) {
        throw new Error('Invalid data URL for cached preview');
      }
      const mimeMatch = header.match(/^data:(.+);base64$/);
      if (mimeMatch && mimeMatch[1]) {
        contentType = mimeMatch[1];
      }
      const binary = atob(data);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      arrayBuffer = bytes.buffer;
    } else {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch preview asset for caching: ${response.status}`);
      }

      contentType = response.headers.get('content-type') ?? 'image/jpeg';
      arrayBuffer = await response.arrayBuffer();
    }

    return this.uploadFromBuffer(arrayBuffer, storagePath, {
      cacheControl: options.cacheControl,
      contentType
    }, requiresWatermark);
  }

  /**
   * Upload buffer to appropriate bucket based on watermark requirement
   * @param requiresWatermark - If true, uploads to public bucket; if false, uploads to premium bucket
   */
  async uploadFromBuffer(buffer: ArrayBuffer, storagePath: string, options: UploadOptions = {}, requiresWatermark = true): Promise<StorageUploadResult> {
    const cacheControl = options.cacheControl ?? 'public, max-age=2592000';
    const contentType = options.contentType ?? 'image/jpeg';

    // Select bucket based on watermark requirement
    const targetBucket = requiresWatermark ? this.publicBucket : this.premiumBucket;
    const isPublicBucket = requiresWatermark;

    const uploadResponse = await this.supabase
      .storage
      .from(targetBucket)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
        cacheControl
      });

    if (uploadResponse.error) {
      throw new Error(`Supabase storage upload failed: ${uploadResponse.error.message}`);
    }

    // Public display bucket: world-readable URL is the access URL.
    // Premium clean bucket: return a storage locator only. Callers must mint
    // a short-lived signed URL after authorization. Never treat getPublicUrl
    // as proof of entitlement.
    if (!isPublicBucket) {
      return {
        storagePath,
        publicUrl: `${this.premiumBucket}/${storagePath}`,
        isPublicBucket,
        bucket: targetBucket
      };
    }

    const publicUrlResponse = this.supabase
      .storage
      .from(targetBucket)
      .getPublicUrl(storagePath, {
        transform: undefined
      });

    const publicUrl = publicUrlResponse.data?.publicUrl;

    if (!publicUrl) {
      throw new Error('Failed to resolve public URL for cached preview');
    }

    return {
      storagePath,
      publicUrl,
      isPublicBucket,
      bucket: targetBucket
    };
  }

  getPublicUrl(storagePath: string, isPublicBucket = true): string | null {
    if (!isPublicBucket) {
      return null;
    }
    const publicUrlResponse = this.supabase
      .storage
      .from(this.publicBucket)
      .getPublicUrl(storagePath, {
        transform: undefined
      });

    return publicUrlResponse.data?.publicUrl ?? null;
  }

  /**
   * Generate a signed URL for premium bucket access
   * @param storagePath - Path in premium bucket
   * @param expiresInSeconds - URL expiry time (default: 24 hours)
   */
  async createSignedUrl(storagePath: string, expiresInSeconds = 86400): Promise<SignedUrlResult> {
    const { data, error } = await this.supabase
      .storage
      .from(this.premiumBucket)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${error?.message ?? 'Unknown error'}`);
    }

    return {
      signedUrl: data.signedUrl,
      expiresAt: Date.now() + (expiresInSeconds * 1000)
    };
  }

  /**
   * Check if a storage path exists in the specified bucket
   */
  async exists(storagePath: string, isPublicBucket = true): Promise<boolean> {
    const bucket = isPublicBucket ? this.publicBucket : this.premiumBucket;
    const { data, error } = await this.supabase
      .storage
      .from(bucket)
      .list(storagePath.split('/').slice(0, -1).join('/'), {
        search: storagePath.split('/').pop()
      });

    if (error) return false;
    return data && data.length > 0;
  }
}
