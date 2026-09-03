
export interface ReplicateGenerationRequest {
  input: {
    prompt: string;
    aspect_ratio?: string;
    quality?: string;
    size?: string;
    max_images?: number;
    request_id?: string;
    image_input?: string[];
    input_images?: string[];
    openai_api_key?: string;
  };
}

export interface ReplicateGenerationResponse {
  ok: boolean;
  output?: string | string[];
  error?: string;
  technicalError?: string;
  statusCode?: number;
  status?: string;
  id?: string;
  metrics?: {
    predict_time?: number;
  };
  urls?: {
    get?: string;
  };
}

export interface ReplicatePredictionStatus {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
}
