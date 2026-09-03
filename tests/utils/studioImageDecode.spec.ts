import { describe, expect, it } from 'vitest';
import { computeStudioDecodeSize, STUDIO_DECODE_MAX_EDGE } from '@/utils/studioImageDecode';

describe('studioImageDecode', () => {
  it('leaves photos already within the mobile decode budget unchanged', () => {
    expect(computeStudioDecodeSize(1600, 1200)).toEqual({ width: 1600, height: 1200, scaled: false });
    expect(computeStudioDecodeSize(STUDIO_DECODE_MAX_EDGE, STUDIO_DECODE_MAX_EDGE)).toEqual({
      width: STUDIO_DECODE_MAX_EDGE,
      height: STUDIO_DECODE_MAX_EDGE,
      scaled: false,
    });
  });

  it('scales a large memorial photo down to the 2048 edge', () => {
    expect(computeStudioDecodeSize(8000, 6000)).toEqual({ width: 2048, height: 1536, scaled: true });
    expect(computeStudioDecodeSize(4000, 8000)).toEqual({ width: 1024, height: 2048, scaled: true });
  });

  it('does not invent dimensions for invalid input', () => {
    expect(computeStudioDecodeSize(0, 100)).toEqual({ width: 0, height: 0, scaled: false });
    expect(computeStudioDecodeSize(Number.NaN, 100)).toEqual({ width: 0, height: 0, scaled: false });
  });
});
