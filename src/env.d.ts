/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ENABLE_PREVIEW_QUERY?: string;
  readonly VITE_REQUIRE_AUTH_FOR_PREVIEW?: string;
  readonly VITE_STORY_LAYER_ENABLED?: string;
  readonly VITE_AUTH_GATE_ROLLOUT?: string;
  readonly VITE_HEIC_EDGE_CONVERSION?: string;
  readonly VITE_ENABLE_QUICKVIEW_DELETE_MODE?: string;
  readonly VITE_AUTH_GOOGLE_ENABLED?: string;
  readonly VITE_AUTH_MICROSOFT_ENABLED?: string;
  readonly VITE_AUTH_FACEBOOK_ENABLED?: string;
  readonly VITE_RELEASE_SHA?: string;
  readonly VITE_BUILD_ID?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
