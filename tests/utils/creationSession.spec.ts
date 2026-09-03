import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildCreationSessionSnapshot,
  clearCreationSession,
  CREATION_SESSION_KEY,
  loadCreationSession,
  saveCreationSession,
  shouldHydrateCreationSession,
} from '@/utils/creationSession';

const memory = new Map<string, string>();

const stubSessionStorage = () => {
  memory.clear();
  const sessionStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: { sessionStorage },
  });
};

describe('creationSession', () => {
  beforeEach(() => {
    stubSessionStorage();
  });

  afterEach(() => {
    clearCreationSession();
    memory.clear();
  });

  it('keeps the last ready artwork across a recoverable failure', () => {
    const ready = buildCreationSessionSnapshot({
      croppedImage: 'data:image/jpeg;base64,ready',
      orientation: 'square',
      selectedStyleId: 'classic-oil-painting',
      previewStatus: 'ready',
      previewUrl: 'https://cdn.example.com/art.jpg',
      previewStyleId: 'classic-oil-painting',
      sessionUserId: null,
    });

    const afterError = buildCreationSessionSnapshot({
      croppedImage: 'data:image/jpeg;base64,ready',
      orientation: 'square',
      selectedStyleId: 'classic-oil-painting',
      previewStatus: 'error',
      previewUrl: undefined,
      previewStyleId: 'classic-oil-painting',
      sessionUserId: null,
      previous: ready,
    });

    expect(afterError.lastPreviewUrl).toBe('https://cdn.example.com/art.jpg');
    expect(afterError.lastPreviewStyleId).toBe('classic-oil-painting');
    expect(afterError.croppedImage).toBe('data:image/jpeg;base64,ready');
  });

  it('drops the last artwork when a new photo is chosen', () => {
    const previous = buildCreationSessionSnapshot({
      croppedImage: 'data:image/jpeg;base64,first',
      orientation: 'square',
      selectedStyleId: 'classic-oil-painting',
      previewStatus: 'ready',
      previewUrl: 'https://cdn.example.com/art.jpg',
      previewStyleId: 'classic-oil-painting',
    });

    const next = buildCreationSessionSnapshot({
      croppedImage: 'data:image/jpeg;base64,second-photo',
      orientation: 'square',
      selectedStyleId: 'classic-oil-painting',
      previewStatus: 'idle',
      previous,
    });

    expect(next.lastPreviewUrl).toBeNull();
    expect(next.lastPreviewStyleId).toBeNull();
  });

  it('does not persist blob preview URLs that cannot survive refresh', () => {
    const snapshot = buildCreationSessionSnapshot({
      croppedImage: 'data:image/jpeg;base64,ready',
      orientation: 'vertical',
      selectedStyleId: 'watercolor-dreams',
      previewStatus: 'ready',
      previewUrl: 'blob:https://example.com/tmp',
      previewStyleId: 'watercolor-dreams',
    });
    expect(snapshot.lastPreviewUrl).toBeNull();
  });

  it('round-trips a snapshot through sessionStorage for refresh restore', () => {
    const snapshot = buildCreationSessionSnapshot({
      croppedImage: 'data:image/jpeg;base64,ready',
      orientation: 'horizontal',
      selectedStyleId: 'neon-splash',
      previewStatus: 'ready',
      previewUrl: 'https://cdn.example.com/art.jpg',
      previewStyleId: 'neon-splash',
      sessionUserId: null,
    });
    expect(saveCreationSession(snapshot)).toBe(true);
    expect(window.sessionStorage.getItem(CREATION_SESSION_KEY)).toBeTruthy();
    expect(loadCreationSession()).toEqual(snapshot);
    expect(
      shouldHydrateCreationSession(snapshot, { croppedImage: null, sessionUserId: null })
    ).toBe(true);
    expect(
      shouldHydrateCreationSession(snapshot, { croppedImage: 'data:already', sessionUserId: null })
    ).toBe(false);
  });

  it('does not hydrate another signed-in account from a leftover session', () => {
    const snapshot = buildCreationSessionSnapshot({
      croppedImage: 'data:image/jpeg;base64,ready',
      orientation: 'square',
      selectedStyleId: 'neon-splash',
      sessionUserId: 'user-a',
    });
    expect(
      shouldHydrateCreationSession(snapshot, { croppedImage: null, sessionUserId: 'user-b' })
    ).toBe(false);
    expect(
      shouldHydrateCreationSession(snapshot, { croppedImage: null, sessionUserId: null })
    ).toBe(false);
  });
});
