/**
 * azureOcrService.ts — DEPRECATED
 * Azure Computer Vision has been replaced by AWS Textract.
 * This file is a compatibility stub that redirects to AWS.
 * @deprecated Use services/ocr/providers/awsTextractProvider.ts instead
 */

export interface AzureOCRConfig {
  endpoint: string;
  apiKey: string;
}

export interface AzureOCRResult {
  text: string;
  confidence: number;
  pageCount: number;
  wordCount: number;
  error?: string;
}

export const loadAzureOCRConfig = (): AzureOCRConfig | null => null;
export const saveAzureOCRConfig = (_config: AzureOCRConfig): void => {};
export const testAzureOCRConnection = async (_endpoint: string, _key: string) => ({
  success: false,
  message: 'Azure OCR has been replaced by AWS Textract. Configure AWS credentials instead.',
});

export const performAzureOCR = async (
  _file: File,
  _onProgress?: (pct: number, status: string) => void
): Promise<AzureOCRResult> => ({
  text: '',
  confidence: 0,
  pageCount: 0,
  wordCount: 0,
  error: 'Azure OCR is no longer available. AWS Textract is now the default OCR provider.',
});

export const isAzureOCRConfigured = (): boolean => false;
