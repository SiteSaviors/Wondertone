import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import {
  FUNNEL_SCHEMA_VERSION,
  isAllowlistedFunnelEvent,
  sanitizeFunnelProperties,
} from '../_shared/funnelEventContract.ts';
import { createSafeLogger, safeErrorMessage } from '../_shared/safeLogger.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const RELEASE_SHA = (Deno.env.get('WT_RELEASE_SHA') ?? Deno.env.get('GITHUB_SHA') ?? 'unknown').slice(0, 64);
const RELEASE_BUILD_ID = (Deno.env.get('WT_BUILD_ID') ?? Deno.env.get('GITHUB_RUN_ID') ?? RELEASE_SHA).slice(0, 64);

const logger = createSafeLogger('ingest-funnel-event');
const MAX_EVENTS = 20;
const SESSION_ID_MAX = 80;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type IngestEvent = {
  schemaVersion?: number;
  eventName?: string;
  occurredAt?: string;
  sessionId?: string;
  source?: string;
  release?: { gitSha?: string; buildId?: string };
  properties?: Record<string, unknown>;
};

const isIsoDate = (value: string): boolean => Number.isFinite(Date.parse(value));

const normalizeSessionId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > SESSION_ID_MAX) return null;
  if (/[^\w-:]/.test(trimmed)) return null;
  return trimmed;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('missing_supabase_config');
    return json({ ok: false, error: 'configuration_error' }, 500);
  }

  try {
    const body = await req.json().catch(() => null);
    const rawEvents: IngestEvent[] = Array.isArray(body?.events)
      ? body.events
      : body && typeof body === 'object'
        ? [body as IngestEvent]
        : [];

    if (rawEvents.length === 0) {
      return json({ ok: false, error: 'empty_batch' }, 400);
    }

    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let userId: string | null = null;
    if (token && token !== SUPABASE_SERVICE_ROLE_KEY && token !== SUPABASE_ANON_KEY) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user?.id) {
        userId = data.user.id;
      }
    }

    const rows = [];
    let rejected = 0;
    for (const event of rawEvents.slice(0, MAX_EVENTS)) {
      if (!event || typeof event.eventName !== 'string' || !isAllowlistedFunnelEvent(event.eventName)) {
        rejected += 1;
        continue;
      }
      if (event.source === 'server' && event.eventName !== 'server_checkout_intent_created') {
        rejected += 1;
        continue;
      }
      const occurredAt =
        typeof event.occurredAt === 'string' && isIsoDate(event.occurredAt)
          ? event.occurredAt
          : new Date().toISOString();
      const sessionId = normalizeSessionId(event.sessionId);
      const releaseSha =
        typeof event.release?.gitSha === 'string' && event.release.gitSha.length <= 64
          ? event.release.gitSha
          : RELEASE_SHA;
      const releaseBuildId =
        typeof event.release?.buildId === 'string' && event.release.buildId.length <= 64
          ? event.release.buildId
          : RELEASE_BUILD_ID;

      rows.push({
        schema_version: FUNNEL_SCHEMA_VERSION,
        event_name: event.eventName,
        occurred_at: occurredAt,
        release_sha: releaseSha,
        release_build_id: releaseBuildId,
        session_id: sessionId,
        user_id: userId,
        source: event.eventName === 'server_checkout_intent_created' ? 'server' : 'client',
        properties: sanitizeFunnelProperties(event.properties),
      });
    }

    if (rows.length === 0) {
      return json({ ok: true, accepted: 0, rejected }, 202);
    }

    const { error: insertError } = await supabase.from('funnel_events').insert(rows);
    if (insertError) {
      logger.error('insert_failed', { code: insertError.code });
      return json({ ok: false, error: 'persist_failed' }, 500);
    }

    return json({ ok: true, accepted: rows.length, rejected }, 202);
  } catch (error) {
    logger.error('unexpected_error', { message: safeErrorMessage(error) });
    return json({ ok: false, error: 'internal_error' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
