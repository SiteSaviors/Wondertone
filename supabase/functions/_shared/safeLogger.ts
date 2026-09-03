const SENSITIVE_KEY_PATTERN =
  /email|password|secret|token|authorization|apikey|api[_-]?key|service[_-]?role|signed[_-]?url|prompt|image|photo|cookie|jwt|stripe|credential|phone|address|webhook/i;

const SENSITIVE_VALUE_PATTERN =
  /(?:https?:\/\/|data:image\/|Bearer\s+|sk_(?:live|test)_|eyJ[A-Za-z0-9_-]{10,}|service_role|token=|sig=|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

const MAX_STRING = 120;

const redactString = (value: string): string => {
  if (SENSITIVE_VALUE_PATTERN.test(value)) {
    return '[redacted]';
  }
  if (value.length > MAX_STRING) {
    return `${value.slice(0, 40)}…[truncated ${value.length}]`;
  }
  return value;
};

export const redactLogValue = (value: unknown, key = ''): unknown => {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return '[redacted]';
  }
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((entry) => redactLogValue(entry));
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      output[entryKey] = redactLogValue(entryValue, entryKey);
    }
    return output;
  }
  return '[unserializable]';
};

export const safeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return redactString(error.message);
  }
  if (typeof error === 'string') {
    return redactString(error);
  }
  return 'unknown_error';
};

type LogLevel = 'info' | 'warn' | 'error';

const write = (level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>) => {
  const payload = {
    level,
    scope,
    message,
    ...(meta ? { meta: redactLogValue(meta) } : {}),
    timestamp: new Date().toISOString(),
  };
  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
};

export const createSafeLogger = (scope: string) => ({
  info: (message: string, meta?: Record<string, unknown>) => write('info', scope, message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', scope, message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', scope, message, meta),
});
