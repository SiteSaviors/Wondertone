export class OpenAIService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateStyledImage(imageDataUrl: string, stylePrompt: string, size: string, _requestId: string): Promise<string | null> {
    try {
      // Create a comprehensive prompt that includes the style transformation
      const fullPrompt = `Transform this image with the following style: ${stylePrompt}. Maintain the same composition, subject positioning, and key visual elements while applying the artistic style transformation.`;

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: fullPrompt,
          size: size,
          n: 1,
          quality: 'auto'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data && result.data[0]?.b64_json) {
          // gpt-image-1 returns base64, convert to data URL
          return `data:image/png;base64,${result.data[0].b64_json}`;
        }
      } else {
        await response.json().catch(() => ({}));
        console.error(JSON.stringify({ scope: 'openai-service', message: 'image_generation_failed', status: response.status }));
      }
    } catch {
      console.error(JSON.stringify({ scope: 'openai-service', message: 'image_generation_exception' }));
    }
    return null;
  }

  // Keep legacy methods as fallbacks
  async tryImageVariations(imageBlob: Blob, stylePrompt: string, size: string, _requestId: string): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('image', imageBlob, 'image.jpg');
      formData.append('model', 'gpt-image-1');
      formData.append('size', size);
      formData.append('n', '1');

      const response = await fetch('https://api.openai.com/v1/images/variations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data && result.data[0]?.url) {
          return result.data[0].url;
        }
      } else {
        await response.json().catch(() => ({}));
        console.error(JSON.stringify({ scope: 'openai-service', message: 'image_variations_failed', status: response.status }));
      }
    } catch {
      console.error(JSON.stringify({ scope: 'openai-service', message: 'image_variations_exception' }));
    }
    return null;
  }

  async tryImageEdits(imageBlob: Blob, stylePrompt: string, size: string, _requestId: string): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('image', imageBlob, 'image.jpg');
      formData.append('prompt', stylePrompt);
      formData.append('model', 'gpt-image-1');
      formData.append('size', size);
      formData.append('n', '1');

      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data && result.data[0]?.url) {
          return result.data[0].url;
        }
      } else {
        await response.json().catch(() => ({}));
        console.error(JSON.stringify({ scope: 'openai-service', message: 'image_edits_failed', status: response.status }));
      }
    } catch {
      console.error(JSON.stringify({ scope: 'openai-service', message: 'image_edits_exception' }));
    }
    return null;
  }

}