import { REPLICATE_CONFIG } from './config.ts';
import { ReplicateGenerationRequest, ReplicateGenerationResponse } from './types.ts';
import { createSafeLogger, safeErrorMessage } from '../../_shared/safeLogger.ts';

const logger = createSafeLogger('replicate-api');

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
        await response.text().catch(() => '');
        logger.error('create_prediction_failed', { status: response.status, model });
        return {
          ok: false,
          error: `${model} API request failed: ${response.status}`,
          technicalError: `status_${response.status}`,
          statusCode: response.status
        };
      }

      const data = await response.json();
      logger.info('create_prediction_ok', { status: response.status, model });

      return {
        ok: true,
        ...data
      };
    } catch (error) {
      logger.error('create_prediction_exception', { message: safeErrorMessage(error) });
      return {
        ok: false,
        error: 'replicate_request_failed',
        technicalError: 'exception'
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
        await response.text().catch(() => '');
        logger.error('prediction_status_failed', { status: response.status });
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
      logger.error('prediction_status_exception', { message: safeErrorMessage(error) });
      return {
        ok: false,
        error: 'prediction_status_failed'
      };
    }
  }
}
