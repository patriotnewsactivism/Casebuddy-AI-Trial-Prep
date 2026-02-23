import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

interface OCRRequest {
  provider: 'google-document-ai' | 'aws-textract' | 'azure-document-intelligence' | 'mathpix';
  action: string;
  payload: {
    content: string;
    mimeType: string;
    [key: string]: unknown;
  };
  options?: {
    language?: string;
    enableHandwriting?: boolean;
    enableTableExtraction?: boolean;
    enableFormRecognition?: boolean;
    preserveLayout?: boolean;
  };
}

async function processGoogleDocumentAI(payload: Record<string, any>): Promise<any> {
  const apiKey = Deno.env.get('GOOGLE_DOCUMENT_AI_KEY');
  const processorId = Deno.env.get('GOOGLE_DOCUMENT_AI_PROCESSOR_ID');
  const location = Deno.env.get('GOOGLE_DOCUMENT_AI_LOCATION') || 'us';
  const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT');
  
  if (!apiKey || !processorId || !projectId) {
    throw new Error('Google Document AI not configured. Set GOOGLE_DOCUMENT_AI_KEY, GOOGLE_DOCUMENT_AI_PROCESSOR_ID, and GOOGLE_CLOUD_PROJECT');
  }
  
  const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;
  
  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      rawDocument: {
        content: payload.content,
        mimeType: payload.mimeType
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Document AI error: ${error}`);
  }
  
  return response.json();
}

async function processAWSTextract(payload: Record<string, any>): Promise<any> {
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const region = payload.region || Deno.env.get('AWS_REGION') || 'us-east-1';
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS Textract not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
  }
  
  const endpoint = `https://textract.${region}.amazonaws.com/`;
  
  const body: Record<string, any> = {
    Document: {
      Bytes: payload.content
    }
  };
  
  if (payload.featureTypes && payload.featureTypes.length > 0) {
    body.FeatureTypes = payload.featureTypes;
  }
  
  const credentials = btoa(`${accessKeyId}:${secretAccessKey}`);
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'Textract.DetectDocumentText',
      'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}`
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AWS Textract error: ${error}`);
  }
  
  return response.json();
}

async function processAzureDocumentIntelligence(payload: Record<string, any>): Promise<any> {
  const apiKey = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_KEY');
  const endpoint = payload.endpoint || Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT');
  
  if (!apiKey || !endpoint) {
    throw new Error('Azure Document Intelligence not configured. Set AZURE_DOCUMENT_INTELLIGENCE_KEY and AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT');
  }
  
  const modelId = payload.modelId || 'prebuilt-read';
  const url = `${endpoint}/documentintelligence/documentModels/${modelId}:analyze?api-version=2024-02-29-preview`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey
    },
    body: JSON.stringify({
      base64Source: payload.content
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Azure Document Intelligence error: ${error}`);
  }
  
  const operationLocation = response.headers.get('Operation-Location');
  
  if (operationLocation) {
    let result: any = null;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 1000));
      
      const statusResponse = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey
        }
      });
      
      if (!statusResponse.ok) {
        throw new Error('Failed to get analysis status');
      }
      
      result = await statusResponse.json();
      
      if (result.status === 'succeeded') {
        return result;
      } else if (result.status === 'failed') {
        throw new Error(`Analysis failed: ${result.error?.message || 'Unknown error'}`);
      }
      
      attempts++;
    }
    
    throw new Error('Analysis timed out');
  }
  
  return response.json();
}

async function processMathpix(payload: Record<string, any>): Promise<any> {
  const apiKey = Deno.env.get('MATHPIX_API_KEY');
  const appId = Deno.env.get('MATHPIX_APP_ID');
  
  if (!apiKey || !appId) {
    throw new Error('Mathpix not configured. Set MATHPIX_API_KEY and MATHPIX_APP_ID');
  }
  
  const response = await fetch('https://api.mathpix.com/v3/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'app_id': appId,
      'app_key': apiKey
    },
    body: JSON.stringify({
      src: `data:${payload.mimeType};base64,${payload.content}`,
      ...payload.options
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mathpix error: ${error}`);
  }
  
  return response.json();
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }
  
  try {
    const body: OCRRequest = await req.json();
    const { provider, action, payload } = body;
    
    let result: any;
    
    switch (provider) {
      case 'google-document-ai':
        result = await processGoogleDocumentAI(payload);
        break;
      
      case 'aws-textract':
        result = await processAWSTextract(payload);
        break;
      
      case 'azure-document-intelligence':
        result = await processAzureDocumentIntelligence(payload);
        break;
      
      case 'mathpix':
        result = await processMathpix(payload);
        break;
      
      default:
        throw new Error(`Unknown OCR provider: ${provider}`);
    }
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('OCR Proxy Error:', error);
    
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
