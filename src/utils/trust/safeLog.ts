const SENSITIVE_KEY_PATTERN =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[_-]?key|apikey|token|access_token|refresh_token|id_token|jwt|bearer|secret|password|passwd|service[_-]?role|supabase[_-]?service[_-]?role|stripe[_-]?(secret|webhook)|sk_live|sk_test|rk_live|rk_test|whsec|replicate[_-]?api[_-]?token|openai[_-]?api[_-]?key|signed[_-]?url|signedurl)$/i;

const jwtPattern = () => /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const bearerPattern = () => /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const stripeSecretPattern = () => /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+/g;
const stripeWebhookPattern = () => /\bwhsec_[A-Za-z0-9]+/g;
const serviceRolePattern = () => /\bsb_secret_[A-Za-z0-9]+/g;
const signedQueryPattern = () => /([?&](?:token|signature|sig)=)[^&\s]+/gi;
const premiumPathPattern = () => /preview-cache-premium\/[A-Za-z0-9/_\-.]+/gi;
const premiumPublicUrlPattern = () =>
  /https?:\/\/[^\s"']+\/storage\/v1\/object\/(?:public|sign|authenticated)\/preview-cache-premium\/[^\s"']+/gi;

const REDACTED = '[REDACTED]';

const redactString = (value: string): string =>
  value
    .replace(jwtPattern(), REDACTED)
    .replace(bearerPattern(), `Bearer ${REDACTED}`)
    .replace(stripeSecretPattern(), REDACTED)
    .replace(stripeWebhookPattern(), REDACTED)
    .replace(serviceRolePattern(), REDACTED)
    .replace(signedQueryPattern(), `$1${REDACTED}`)
    .replace(premiumPublicUrlPattern(), REDACTED)
    .replace(premiumPathPattern(), 'preview-cache-premium/[REDACTED]');

const isSensitiveKey = (key: string): boolean => SENSITIVE_KEY_PATTERN.test(key);

export const redactLogValue = (value: unknown, key?: string): unknown => {
  if (key && isSensitiveKey(key)) {
    return REDACTED;
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactLogValue(entry));
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      output[childKey] = redactLogValue(childValue, childKey);
    }
    return output;
  }

  return value;
};

export const redactLogMeta = (meta: Record<string, unknown> = {}): Record<string, unknown> =>
  redactLogValue(meta) as Record<string, unknown>;

export const containsCredentialLeak = (value: unknown): boolean => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  if (!serialized) return false;
  return (
    jwtPattern().test(serialized) ||
    /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i.test(serialized) ||
    stripeSecretPattern().test(serialized) ||
    stripeWebhookPattern().test(serialized) ||
    /[?&](?:token|signature|sig)=[A-Za-z0-9._~+/-]{8,}/i.test(serialized) ||
    /\/storage\/v1\/object\/(?:public|sign)\/preview-cache-premium\//i.test(serialized)
  );
};
