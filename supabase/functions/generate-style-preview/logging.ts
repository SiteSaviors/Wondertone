import { redactLogMeta } from '../_shared/safeLog.ts';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelWeights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const resolveLogLevel = (): LogLevel => {
  const rawLevel = (Deno.env.get('PREVIEW_CACHE_LOG_LEVEL') || 'info').toLowerCase();
  if (rawLevel === 'debug' || rawLevel === 'info' || rawLevel === 'warn' || rawLevel === 'error') {
    return rawLevel;
  }
  return 'info';
};

const activeLevel = resolveLogLevel();

const shouldLog = (level: LogLevel): boolean => levelWeights[level] >= levelWeights[activeLevel];

interface LogMeta {
  [key: string]: unknown;
}

export const createRequestLogger = (requestId: string) => {
  const log = (level: LogLevel, message: string, meta: LogMeta = {}) => {
    if (!shouldLog(level)) {
      return;
    }

    const payload = {
      level,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      ...redactLogMeta(meta)
    };

    if (level === 'error') {
      console.error(JSON.stringify(payload));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(payload));
    } else {
      console.log(JSON.stringify(payload));
    }
  };

  return {
    debug: (message: string, meta?: LogMeta) => log('debug', message, meta),
    info: (message: string, meta?: LogMeta) => log('info', message, meta),
    warn: (message: string, meta?: LogMeta) => log('warn', message, meta),
    error: (message: string, meta?: LogMeta) => log('error', message, meta)
  };
};
