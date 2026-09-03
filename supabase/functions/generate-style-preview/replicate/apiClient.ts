
import { REPLICATE_CONFIG } from './config.ts';
import { ReplicateGenerationRequest, ReplicateGenerationResponse } from './types.ts';

export class ReplicateApiClient {
  constructor(private apiToken: string) {}

  async createPrediction(
    requestBody: ReplicateGenerationRequest,
    modelOverride?: string
  ): Promise<ReplicateGenerationResponse> {
    try {
      const model = modelOverride ?? REPLICATE_CONFIG.model;
      const endpoint = `${REPLICATE_CONFIG.baseUrl}/models/${model}/predictions`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
          "Prefer": "wait"
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        await response.text();

        return {
          ok: false,
          error: `${model} API request failed: ${response.status}`,
          technicalError: `replicate_status_${response.status}`,
          statusCode: response.status
        };
      }

      const data = await response.json();

      return {
        ok: true,
        ...data
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: message,
        technicalError: 'replicate_request_exception'
      };
    }
  }

  async getPredictionStatus(predictionId: string): Promise<ReplicateGenerationResponse> {
    try {
      const response = await fetch(`${REPLICATE_CONFIG.baseUrl}/predictions/${predictionId}`, {
        headers: {
          "Authorization": `Bearer ${this.apiToken}`,
        },
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `prediction status check failed: ${response.status}`
        };
      }

      const result = await response.json();
      return {
        ok: true,
        ...result
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: message
      };
    }
  }
}
