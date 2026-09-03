/**
 * Build-time release identification for privacy-bounded funnel analytics.
 * Values are injected by vite.config.ts (git SHA and CI/Vercel build id).
 */
export type ReleaseIdentity = {
  gitSha: string;
  buildId: string;
};

const UNKNOWN = 'unknown';

const readEnv = (value: unknown): string => {
  if (typeof value !== 'string') return UNKNOWN;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : UNKNOWN;
};

export const getReleaseIdentity = (): ReleaseIdentity => {
  const gitSha = readEnv(import.meta.env.VITE_RELEASE_SHA);
  const buildId = readEnv(import.meta.env.VITE_BUILD_ID);
  return {
    gitSha,
    buildId: buildId === UNKNOWN ? gitSha : buildId,
  };
};

export const formatReleaseId = (identity: ReleaseIdentity = getReleaseIdentity()): string =>
  `${identity.gitSha}:${identity.buildId}`;
