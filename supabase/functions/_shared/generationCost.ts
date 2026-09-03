import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { createSafeLogger, safeErrorMessage } from './safeLogger.ts';

const logger = createSafeLogger('generation-cost');

export type GenerationCostOutcome = 'success' | 'failed' | 'cache_hit';

export type GenerationCostEvent = {
  request_id: string;
  style_id?: string | null;
  cache_hit: boolean;
  provider?: string | null;
  provider_fallback: boolean;
  duration_ms?: number | null;
  provider_predict_time_s?: number | null;
  outcome: GenerationCostOutcome;
};

/**
 * Persist measured generation timings from the live code path.
 * Never invent dollar amounts. Failures here must not break preview delivery.
 */
export async function recordGenerationCostEvent(
  supabase: SupabaseClient,
  event: GenerationCostEvent
): Promise<void> {
  try {
    const { error } = await supabase.from('generation_cost_events').insert({
      request_id: event.request_id,
      style_id: event.style_id ?? null,
      cache_hit: event.cache_hit,
      provider: event.provider ?? null,
      provider_fallback: event.provider_fallback,
      duration_ms: typeof event.duration_ms === 'number' ? Math.max(0, Math.round(event.duration_ms)) : null,
      provider_predict_time_s:
        typeof event.provider_predict_time_s === 'number' && Number.isFinite(event.provider_predict_time_s)
          ? event.provider_predict_time_s
          : null,
      outcome: event.outcome,
    });
    if (error) {
      logger.warn('cost_insert_failed', { code: error.code });
    }
  } catch (error) {
    logger.warn('cost_insert_exception', { message: safeErrorMessage(error) });
  }
}
