import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult, OCRBoundingBox } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Convert file to base64 for Gemini API
 */
const fileToBase64 = async (file: File): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const base64Content = base64data.split(',')[1];
      resolve({
        data: base64Content,
        mimeType: file.type || 'application/octet-stream'
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Perform OCR on an image or PDF using Gemini Vision
 */
export const performOCR = async (file: File): Promise<OCRResult> => {
  const startTime = Date.now();
  
  try {
    const { data, mimeType } = await fileToBase64(file);
    
    const prompt = `You are an expert OCR system specializing in legal document analysis.
    
    Extract ALL text from this document with high accuracy.
    
    For legal documents, pay special attention to:
    - Case numbers and citations
    - Dates and timestamps
    - Names (parties, attorneys, judges, witnesses)
    - Legal citations (e.g., "U.S. v. Smith, 123 F.3d 456 (5th Cir. 2023)")
    - Exhibit numbers and labels
    - Signatures and notarization stamps
    - Handwritten annotations (transcribe as [HANDWRITTEN: text])
    
    Return the extracted text in a clean, readable format.
    Preserve document structure (headings, paragraphs, lists).
    If text is illegible, mark as [ILLEGIBLE].
    If this appears to be a multi-page document, indicate page breaks with [PAGE BREAK].
    
    Return JSON with:
    - "text": the full extracted text
    - "confidence": overall confidence score 0-100
    - "detectedLanguage": the primary language detected
    - "wordCount": approximate word count`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            { inlineData: { data, mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            detectedLanguage: { type: Type.STRING },
            wordCount: { type: Type.NUMBER }
          },
          required: ["text", "confidence", "wordCount"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    return {
      text: result.text || '',
      confidence: result.confidence || 75,
      detectedLanguage: result.detectedLanguage || 'en',
      wordCount: result.wordCount || 0,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Perform OCR on multiple pages of a PDF
 * Note: For production, use pdf.js to split PDF into pages first
 */
export const performMultiPageOCR = async (file: File): Promise<OCRResult> => {
  const startTime = Date.now();
  
  try {
    // For now, treat the entire PDF as one document
    // In production, you would use pdf.js to split into individual pages
    const result = await performOCR(file);
    
    return {
      ...result,
      pages: [result.text], // Single page for now
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('Multi-page OCR Error:', error);
    throw error;
  }
};

/**
 * Extract specific fields from a legal document
 */
export const extractLegalDocumentFields = async (file: File): Promise<{
  caseNumber?: string;
  caseName?: string;
  court?: string;
  parties?: string[];
  attorneys?: string[];
  judge?: string;
  date?: string;
  documentType?: string;
}> => {
  try {
    const { data, mimeType } = await fileToBase64(file);
    
    const prompt = `Extract key legal metadata from this document.
    
    Identify:
    - Case number (e.g., "No. 3:23-cv-00123")
    - Case name (e.g., "Smith v. Jones")
    - Court name
    - Party names (plaintiffs and defendants)
    - Attorney names
    - Judge name
    - Document date
    - Document type (motion, brief, contract, etc.)
    
    Return as JSON with these fields. Use null for fields not found.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            { inlineData: { data, mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caseNumber: { type: Type.STRING, nullable: true },
            caseName: { type: Type.STRING, nullable: true },
            court: { type: Type.STRING, nullable: true },
            parties: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
            attorneys: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
            judge: { type: Type.STRING, nullable: true },
            date: { type: Type.STRING, nullable: true },
            documentType: { type: Type.STRING, nullable: true }
          }
        }
      }
    });

    return JSON.parse(response.text || '{}');

  } catch (error) {
    console.error('Field extraction error:', error);
    return {};
  }
};

/**
 * Check if a file is a valid document for OCR
 */
export const isValidOCRFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/tiff',
    'image/tif',
    'image/bmp',
    'image/webp',
    'image/gif'
  ];
  
  const validExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp', 'gif'];
  
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (!validTypes.includes(file.type) && (!extension || !validExtensions.includes(extension))) {
    return { 
      valid: false, 
      error: 'Invalid file type. Supported formats: PDF, PNG, JPG, TIFF, BMP, WebP, GIF' 
    };
  }
  
  // Max 50MB for documents
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File size exceeds 50MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(1)}MB` 
    };
  }
  
  return { valid: true };
};

export default {
  performOCR,
  performMultiPageOCR,
  extractLegalDocumentFields,
  isValidOCRFile
};
