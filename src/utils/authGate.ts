import { AUTH_GATE_ROLLOUT_PERCENT, REQUIRE_AUTH_FOR_PREVIEW } from '@/config/featureFlags';
import { getProductSurfaceRules } from '@/config/productSurface';

const BUCKET_STORAGE_KEY = 'wt_auth_gate_bucket_v1';

const clampBucket = (value: number): number => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 99) return 99;
  return Math.trunc(value);
};

const readStoredBucket = (): number | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BUCKET_STORAGE_KEY);
    if (raw == null) {
      return null;
    }
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return clampBucket(parsed);
  } catch {
    return null;
  }
};

const persistBucket = (bucket: number) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BUCKET_STORAGE_KEY, String(clampBucket(bucket)));
  } catch {
    // ignore storage failures
  }
};

const generateBucket = (): number => {
  if (typeof window === 'undefined') {
    return 100; // SSR fallback – no gating
  }

  try {
    if (window.crypto?.getRandomValues) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0] % 100;
    }
  } catch {
    // ignore crypto failures and fall back to Math.random
  }

  return Math.floor(Math.random() * 100);
};

export const getAuthGateRolloutBucket = (): number => {
  const stored = readStoredBucket();
  if (stored != null) {
    return stored;
  }
  const bucket = clampBucket(generateBucket());
  persistBucket(bucket);
  return bucket;
};

export const shouldRequireAuthGate = (sessionUserId: string | null): boolean => {
  if (sessionUserId) {
    return false;
  }
  if (getProductSurfaceRules().hideAuthGateBeforeReveal) {
    return false;
  }
  if (REQUIRE_AUTH_FOR_PREVIEW) {
    return true;
  }

  const rollout = AUTH_GATE_ROLLOUT_PERCENT;
  if (!rollout || rollout <= 0) {
    return false;
  }

  const bucket = getAuthGateRolloutBucket();
  return bucket < rollout;
};
