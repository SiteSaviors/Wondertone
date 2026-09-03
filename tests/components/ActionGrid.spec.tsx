import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import ActionGrid from '@/components/studio/ActionGrid';

const fakeWindow = {
  setTimeout: (handler: (...args: unknown[]) => void, timeout?: number) =>
    global.setTimeout(handler, timeout),
  clearTimeout: (id?: number | ReturnType<typeof setTimeout>) =>
    global.clearTimeout(id as ReturnType<typeof setTimeout>),
} as unknown as Window & typeof globalThis;

vi.stubGlobal('window', fakeWindow);

describe('ActionGrid', () => {
  it('uses revealed_artwork_full_res as the only post-reveal CTA', () => {
    const onDownload = vi.fn();
    const onCreateCanvas = vi.fn();

    const renderer = TestRenderer.create(
      <ActionGrid
        onDownload={onDownload}
        onCreateCanvas={onCreateCanvas}
        downloading={false}
        downloadDisabled={false}
        createCanvasDisabled={false}
        isPremiumUser
      />
    );

    const buttons = renderer.root.findAllByType('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props['data-sku']).toBe('revealed_artwork_full_res');

    buttons[0].props.onClick();

    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onCreateCanvas).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain('Get the full-resolution artwork');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Get the full-resolution file.');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Create Canvas Art');
    expect(JSON.stringify(renderer.toJSON())).not.toMatch(/\$\d/);
  });
});
