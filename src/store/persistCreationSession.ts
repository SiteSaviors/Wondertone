import { useFounderStore } from '@/store/useFounderStore';
import {
  buildCreationSessionSnapshot,
  clearCreationSession,
  loadCreationSession,
  saveCreationSession,
  shouldHydrateCreationSession,
} from '@/utils/creationSession';

let started = false;
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lastSerialized = '';

const persistNow = () => {
  const state = useFounderStore.getState();
  const previous = loadCreationSession();
  const preview = state.selectedStyleId ? state.previews[state.selectedStyleId] : undefined;
  const snapshot = buildCreationSessionSnapshot({
    croppedImage: state.croppedImage,
    orientation: state.orientation,
    selectedStyleId: state.selectedStyleId,
    previewStatus: preview?.status ?? null,
    previewUrl: preview?.data?.previewUrl ?? null,
    previewStyleId: state.selectedStyleId,
    sessionUserId: state.sessionUser?.id ?? null,
    previous,
  });
  const serialized = JSON.stringify(snapshot);
  if (serialized === lastSerialized) return;
  if (saveCreationSession(snapshot)) {
    lastSerialized = serialized;
  }
};

export function hydrateCreationSessionOnce(): boolean {
  if (hydrated) return false;
  hydrated = true;
  const snapshot = loadCreationSession();
  const state = useFounderStore.getState();
  if (
    !shouldHydrateCreationSession(snapshot, {
      croppedImage: state.croppedImage,
      sessionUserId: state.sessionUser?.id ?? null,
    })
  ) {
    return false;
  }

  useFounderStore.setState((current) => {
    const next: Partial<typeof current> = {};
    if (snapshot.croppedImage) {
      next.croppedImage = snapshot.croppedImage;
      next.originalImage = snapshot.croppedImage;
      next.uploadedImage = snapshot.croppedImage;
      next.launchpadSlimMode = true;
    }
    if (snapshot.orientation) {
      next.orientation = snapshot.orientation;
    }
    if (snapshot.selectedStyleId) {
      next.selectedStyleId = snapshot.selectedStyleId;
    }
    if (snapshot.lastPreviewStyleId && snapshot.lastPreviewUrl) {
      const existing = current.previews[snapshot.lastPreviewStyleId];
      next.previews = {
        ...current.previews,
        [snapshot.lastPreviewStyleId]: {
          status: 'ready',
          data: {
            previewUrl: snapshot.lastPreviewUrl,
            watermarkApplied: existing?.data?.watermarkApplied ?? false,
            startedAt: existing?.data?.startedAt ?? Date.now(),
            completedAt: existing?.data?.completedAt ?? Date.now(),
          },
          orientation: snapshot.orientation ?? existing?.orientation ?? current.orientation,
        },
      };
    }
    return next;
  });
  return true;
}

export function startCreationSessionPersist(): void {
  if (started) return;
  started = true;
  hydrateCreationSessionOnce();
  useFounderStore.subscribe(() => {
    if (persistTimer) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(persistNow, 200);
  });
}

export function resetCreationSessionPersistForTests(): void {
  started = false;
  hydrated = false;
  lastSerialized = '';
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  clearCreationSession();
}
