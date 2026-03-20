import { AzureOCRResult } from '../types';

export interface AzureOCRConfig {
  endpoint: string;
  apiKey: string;
}

const CONFIG_KEY = 'lexsim_azure_ocr';

export const loadAzureOCRConfig = (): AzureOCRConfig | null => {
  // First, try loading from environment variables
  const envEndpoint = process.env.AZURE_VISION_ENDPOINT;
  const envKey = process.env.AZURE_VISION_KEY;

  if (envEndpoint && envKey) {
    return {
      endpoint: envEndpoint,
      apiKey: envKey,
    };
  }

  // Fall back to localStorage
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as AzureOCRConfig;
  } catch (e) {
    return null;
  }
};

export const saveAzureOCRConfig = (config: AzureOCRConfig): void => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Azure OCR config:', e);
  }
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const performAzureOCR = async (
  file: File,
  onProgress?: (pct: number, status: string) => void
): Promise<AzureOCRResult> => {
  const config = loadAzureOCRConfig();

  if (!config || !config.endpoint || !config.apiKey) {
    return {
      text: '',
      confidence: 0,
      pageCount: 0,
      wordCount: 0,
      error: 'Azure OCR not configured. Please add endpoint and API key in Settings.',
    };
  }

  try {
    onProgress?.(5, 'Uploading document...');

    const arrayBuffer = await file.arrayBuffer();
    const analyzeUrl = `${config.endpoint}/vision/v3.2/read/analyze`;

    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': config.apiKey,
      },
      body: arrayBuffer,
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Azure OCR API error: ${response.status} - ${errorData}`);
    }

    const operationLocation = response.headers.get('Operation-Location');
    if (!operationLocation) {
      throw new Error('No Operation-Location header in response');
    }

    onProgress?.(20, 'Processing document...');

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 30;
    let backoffMs = 1500;

    while (attempts < maxAttempts) {
      await sleep(backoffMs);
      attempts++;

      const statusResponse = await fetch(operationLocation, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': config.apiKey,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Failed to check OCR status: ${statusResponse.status}`);
      }

      const result = (await statusResponse.json()) as any;
      const status = result.status;

      const progress = 20 + (attempts / maxAttempts) * 70;
      onProgress?.(Math.min(progress, 90), `Processing... (${status})`);

      if (status === 'succeeded') {
        onProgress?.(95, 'Extracting text...');

        const analyzeResult = result.analyzeResult;
        if (!analyzeResult || !analyzeResult.readResults) {
          throw new Error('Invalid response structure from Azure');
        }

        // Extract text from all pages
        let fullText = '';
        let totalWords = 0;
        const pages = analyzeResult.readResults;

        for (const page of pages) {
          if (page.lines) {
            for (const line of page.lines) {
              fullText += line.text + '\n';
              totalWords += line.text.split(/\s+/).length;
            }
          }
        }

        // Calculate average confidence
        let totalConfidence = 0;
        let confidentCount = 0;
        for (const page of pages) {
          if (page.lines) {
            for (const line of page.lines) {
              if (line.words && line.words.length > 0) {
                const lineConfidence = line.words.reduce((sum: number, w: any) => sum + (w.confidence || 0.8), 0) / line.words.length;
                totalConfidence += lineConfidence;
                confidentCount++;
              }
            }
          }
        }

        const avgConfidence = confidentCount > 0 ? totalConfidence / confidentCount : 0.8;

        onProgress?.(100, 'Complete');

        return {
          text: fullText.trim(),
          confidence: Math.round(avgConfidence * 100) / 100,
          pageCount: pages.length,
          language: analyzeResult.metadata?.language,
          wordCount: totalWords,
        };
      } else if (status === 'failed') {
        throw new Error('Azure OCR processing failed');
      }

      // Exponential backoff with 1.2x multiplier
      backoffMs = Math.min(backoffMs * 1.2, 5000);
    }

    throw new Error('Azure OCR polling timeout after 30 attempts');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during OCR';
    return {
      text: '',
      confidence: 0,
      pageCount: 0,
      wordCount: 0,
      error: message,
    };
  }
};

export const testAzureOCRConnection = async (
  endpoint: string,
  apiKey: string
): Promise<{ ok: boolean; message: string }> => {
  try {
    const testUrl = `${endpoint}/vision/v3.2/read/analyze`;

    // Create minimal test data
    const testData = new ArrayBuffer(4);
    const view = new Uint8Array(testData);
    view[0] = 0x25; // '%'
    view[1] = 0x50; // 'P'
    view[2] = 0x44; // 'D'
    view[3] = 0x46; // 'F'

    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      body: testData,
    });

    if (response.status === 202) {
      return { ok: true, message: 'Connected successfully to Azure Computer Vision API' };
    } else if (response.status === 401) {
      return { ok: false, message: 'Invalid API key' };
    } else if (response.status === 400) {
      // Invalid content is expected for test data, but 400 means the endpoint is reachable
      return { ok: true, message: 'Connected successfully to Azure Computer Vision API' };
    } else {
      return { ok: false, message: `Unexpected status code: ${response.status}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      ok: false,
      message: `Connection failed: ${message}. Check endpoint URL.`,
    };
  }
};
