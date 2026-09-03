import type { Orientation } from '@/utils/imageUtils';

export const CREATION_SESSION_KEY = 'wt_creation_session_v1';
export const CREATION_SESSION_VERSION = 1 as const;
const CREATION_SESSION_MAX_CHARS = 3_500_000;

export type CreationSessionSnapshot = {
  version: typeof CREATION_SESSION_VERSION;
  croppedImage: string | null;
  orientation: Orientation | null;
  selectedStyleId: string | null;
  lastPreviewStyleId: string | null;
  lastPreviewUrl: string | null;
  sessionUserId: string | null;
  imageFingerprint: string | null;
};

export function isPersistablePreviewUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  return url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:');
}

export function isPersistableCroppedImage(url: string | null | undefined): url is string {
  return Boolean(url && url.startsWith('data:'));
}

export function fingerprintImage(dataUrl: string | null | undefined): string | null {
  if (!dataUrl) return null;
  return `${dataUrl.length}:${dataUrl.slice(0, 48)}:${dataUrl.slice(-24)}`;
}

export function buildCreationSessionSnapshot(input: {
  croppedImage: string | null;
  orientation: Orientation | null;
  selectedStyleId: string | null;
  previewStatus?: string | null;
  previewUrl?: string | null;
  previewStyleId?: string | null;
  sessionUserId?: string | null;
  previous?: CreationSessionSnapshot | null;
}): CreationSessionSnapshot {
  const imageFingerprint = fingerprintImage(input.croppedImage);
  const imageChanged =
    Boolean(input.previous?.imageFingerprint) && input.previous?.imageFingerprint !== imageFingerprint;

  let lastPreviewStyleId = input.previous?.lastPreviewStyleId ?? null;
  let lastPreviewUrl = input.previous?.lastPreviewUrl ?? null;

  if (imageChanged) {
    lastPreviewStyleId = null;
    lastPreviewUrl = null;
  }

  const persistableUrl = isPersistablePreviewUrl(input.previewUrl) ? input.previewUrl : null;
  if (input.previewStatus === 'ready' && persistableUrl && input.previewStyleId) {
    lastPreviewStyleId = input.previewStyleId;
    lastPreviewUrl = persistableUrl;
  }

  return {
    version: CREATION_SESSION_VERSION,
    croppedImage: isPersistableCroppedImage(input.croppedImage) ? input.croppedImage : null,
    orientation: input.orientation,
    selectedStyleId: input.selectedStyleId,
    lastPreviewStyleId,
    lastPreviewUrl,
    sessionUserId: input.sessionUserId ?? null,
    imageFingerprint,
  };
}

const canUseSessionStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

export function loadCreationSession(): CreationSessionSnapshot | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(CREATION_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreationSessionSnapshot;
    if (parsed?.version !== CREATION_SESSION_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCreationSession(snapshot: CreationSessionSnapshot): boolean {
  if (!canUseSessionStorage()) return false;
  try {
    const serialized = JSON.stringify(snapshot);
    if (serialized.length > CREATION_SESSION_MAX_CHARS) {
      const withoutImage: CreationSessionSnapshot = { ...snapshot, croppedImage: null };
      window.sessionStorage.setItem(CREATION_SESSION_KEY, JSON.stringify(withoutImage));
      return true;
    }
    window.sessionStorage.setItem(CREATION_SESSION_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function clearCreationSession(): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(CREATION_SESSION_KEY);
  } catch {
    // sessionStorage can throw in locked/private contexts
  }
}

export function shouldHydrateCreationSession(
  snapshot: CreationSessionSnapshot | null,
  current: { croppedImage: string | null; sessionUserId: string | null }
): snapshot is CreationSessionSnapshot {
  if (!snapshot) return false;
  if (current.croppedImage) return false;
  if (snapshot.sessionUserId && current.sessionUserId && snapshot.sessionUserId !== current.sessionUserId) {
    return false;
  }
  if (snapshot.sessionUserId && !current.sessionUserId) {
    return false;
  }
  return Boolean(snapshot.croppedImage || snapshot.lastPreviewUrl || snapshot.selectedStyleId);
}
