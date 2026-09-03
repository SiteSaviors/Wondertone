import { PromptEnhancer } from './replicate/promptEnhancer.ts';
import { PollingService } from './replicate/pollingService.ts';
import { ReplicateApiClient } from './replicate/apiClient.ts';
import { ReplicateGenerationResponse } from './replicate/types.ts';
import { EnhancedErrorHandler, executeWithRetry } from './errorHandling.ts';

/**
 * Maps Wondertone quality setting to SeeDream size parameter
 */
function mapQualityToSize(quality: string): string {
  switch (quality.toLowerCase()) {
    case 'low':
      return '1K';
    case 'high':
      return '4K';
    case 'medium':
    default:
      return '2K';
  }
}

export class ReplicateService {
  private apiToken: string;
  private apiClient: ReplicateApiClient;
  private pollingService: PollingService;

  constructor(apiToken: string) {
    // Clean the token in case it has extra text
    this.apiToken = apiToken.replace(/^export\s+REPLICATE_API_TOKEN=/, '').trim();

    this.apiClient = new ReplicateApiClient(this.apiToken);
    this.pollingService = new PollingService(this.apiToken);
  }

  async generateImageToImage(imageData: string, prompt: string, aspectRatio: string = "1:1", quality: string = "medium"): Promise<ReplicateGenerationResponse> {
    if (!this.apiToken || this.apiToken === 'undefined' || this.apiToken.trim() === '') {
      throw new Error('Invalid or missing Replicate API token');
    }

    if (!imageData || !imageData.startsWith('data:image/')) {
      throw new Error('Invalid image data format. Expected base64 data URL.');
    }

    // Enhance prompt with identity preservation rules
    const enhancedPrompt = PromptEnhancer.enhanceForIdentityPreservation(prompt);

    const seedreamSize = mapQualityToSize(quality);

    const requestBody = {
      input: {
        prompt: enhancedPrompt,
        image_input: [imageData],
        aspect_ratio: aspectRatio, // SeeDream supports 1:1, 3:2, 2:3, 4:3, 16:9
        size: seedreamSize, // 1K, 2K, or 4K
        max_images: 1
      }
    };

    try {
      // Execute with retry logic
      const result = await executeWithRetry(async () => {
        const data = await this.apiClient.createPrediction(requestBody);

        if (!data.ok) {
          throw new Error(data.error || 'API call failed');
        }

        // Handle immediate success
        if (data.status === "succeeded" && data.output) {
          return {
            ok: true,
            output: data.output
          };
        } 
        
        // Handle immediate failure
        if (data.status === "failed") {
          const errorMsg = data.error || "SeeDream generation failed";


          // Check for specific error types
          if (errorMsg.includes('high demand') || errorMsg.includes('E003')) {
            const error = new Error(errorMsg);
            error.name = 'ServiceUnavailable';
            throw error;
          }

          throw new Error(errorMsg);
        }

        // Handle polling requirement
        if (data.status === "processing" || data.status === "starting") {
          const predictionId = data.id;
          const getUrl = data.urls?.get;
          if (!predictionId || !getUrl) {
            throw new Error('Missing prediction ID or get URL for polling');
          }
          return await this.pollingService.pollForCompletion(predictionId, getUrl);
        }

        throw new Error(`Unexpected status: ${data.status}`);
      }, 'SeeDream Generation');

      if (!result.ok) {
        console.error(JSON.stringify({ scope: 'replicate-service', message: 'generation_not_ok', errorType: result.errorType }));
      }

      return result;

    } catch (error) {
      const parsedError = EnhancedErrorHandler.parseError(error);
      const userMessage = EnhancedErrorHandler.createUserFriendlyMessage(parsedError);
      console.error(JSON.stringify({
        scope: 'replicate-service',
        message: 'generation_exception',
        errorType: parsedError.type,
      }));
      
      return {
        ok: false,
        error: userMessage,
        technicalError: error instanceof Error ? error.message : String(error),
        errorType: parsedError.type
      };
    }
  }

  async generateImageToImageWithGpt(
    imageData: string,
    prompt: string,
    aspectRatio: string,
    quality: string,
    openAiApiKey: string
  ): Promise<ReplicateGenerationResponse> {
    if (!openAiApiKey) {
      return {
        ok: false,
        error: 'GPT-Image-1 fallback is disabled: OPENAI_API_KEY not configured'
      };
    }

    const enhancedPrompt = PromptEnhancer.enhanceForIdentityPreservation(prompt);
    const requestBody = {
      input: {
        prompt: enhancedPrompt,
        input_images: [imageData],
        openai_api_key: openAiApiKey,
        aspect_ratio: aspectRatio,
        quality
      }
    };

    try {
      const result = await executeWithRetry(async () => {
        const data = await this.apiClient.createPrediction(requestBody, 'openai/gpt-image-1');

        if (!data.ok) {
          throw new Error(data.error || 'API call failed');
        }

        if (data.status === 'succeeded' && data.output) {
          return {
            ok: true,
            output: data.output
          };
        }

        if (data.status === 'failed') {
          throw new Error(data.error || 'GPT-Image-1 generation failed');
        }

        if (data.status === 'processing' || data.status === 'starting') {
          const predictionId = data.id;
          const getUrl = data.urls?.get;
          if (!predictionId || !getUrl) {
            throw new Error('Missing prediction ID or get URL for polling');
          }
          return await this.pollingService.pollForCompletion(predictionId, getUrl);
        }

        throw new Error(`Unexpected status: ${data.status}`);
      }, 'GPT-Image-1 Fallback');

      return result;
    } catch (error) {
      const parsedError = EnhancedErrorHandler.parseError(error);
      const userMessage = EnhancedErrorHandler.createUserFriendlyMessage(parsedError);

      console.error(JSON.stringify({
        scope: 'replicate-service',
        message: 'gpt_fallback_exception',
        errorType: parsedError.type,
      }));

      return {
        ok: false,
        error: userMessage,
        technicalError: error instanceof Error ? error.message : String(error),
        errorType: parsedError.type
      };
    }
  }

  async getPredictionStatus(predictionId: string): Promise<ReplicateGenerationResponse> {
    return this.apiClient.getPredictionStatus(predictionId);
  }
}
