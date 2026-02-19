/**
 * OCR Service using Tesseract.js and PDF.js
 * Client-side OCR with no rate limits or file size restrictions
 */

import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { OCRResult, OCRBoundingBox } from "../types";

// Set up PDF.js worker - use CDN for browser
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Track Tesseract worker for reuse
let tesseractWorker: Tesseract.Worker | null = null;

/**
 * Get or create a Tesseract worker
 */
const getTesseractWorker = async (): Promise<Tesseract.Worker> => {
  if (!tesseractWorker) {
    tesseractWorker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
  }
  return tesseractWorker;
};

/**
 * Convert a file to an ArrayBuffer
 */
const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Convert a canvas to a Blob
 */
const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
};

/**
 * Render a PDF page to a canvas
 */
const renderPageToCanvas = async (
  page: pdfjsLib.PDFPageProxy,
  scale: number = 2.0
): Promise<HTMLCanvasElement> => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const context = canvas.getContext('2d')!;
  await page.render({
    canvasContext: context,
    viewport
  }).promise;
  
  return canvas;
};

/**
 * Perform OCR on an image using Tesseract.js
 */
const ocrImage = async (
  image: Blob | HTMLCanvasElement | string,
  onProgress?: (progress: number) => void
): Promise<{ text: string; confidence: number }> => {
  const worker = await getTesseractWorker();
  
  const result = await worker.recognize(
    image,
    {},
    {
      text: true,
      blocks: true,
      hocr: false,
      tsv: false
    }
  );
  
  const confidence = result.data.confidence || 0;
  const text = result.data.text || '';
  
  return { text, confidence };
};

/**
 * Extract text from a PDF using PDF.js (for text-based PDFs)
 */
const extractPdfText = async (pdf: pdfjsLib.PDFDocument): Promise<string[]> => {
  const pages: string[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    pages.push(pageText);
  }
  
  return pages;
};

/**
 * Perform OCR on a single image file
 */
export const performOCR = async (
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> => {
  const startTime = Date.now();
  
  try {
    onProgress?.(0, 'Initializing OCR engine...');
    
    const { text, confidence } = await ocrImage(file, (p) => {
      onProgress?.(p * 100, 'Recognizing text...');
    });
    
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    
    return {
      text,
      confidence: Math.round(confidence),
      wordCount,
      detectedLanguage: 'en',
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Perform OCR on a PDF document
 * Uses PDF.js to extract text layer first, then OCR for scanned pages
 */
export const performPdfOCR = async (
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> => {
  const startTime = Date.now();
  
  try {
    onProgress?.(0, 'Loading PDF...');
    
    const arrayBuffer = await fileToArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    
    onProgress?.(5, `Processing ${totalPages} pages...`);
    
    // Try to extract text layer first
    const textPages = await extractPdfText(pdf);
    
    // Check if PDF has meaningful text content (not just scanned images)
    const totalTextLength = textPages.reduce((sum, p) => sum + p.length, 0);
    const needsOCR = totalTextLength < totalPages * 100; // Less than ~100 chars per page suggests scanned PDF
    
    let allPages: string[] = [];
    let totalConfidence = 0;
    
    if (!needsOCR) {
      // PDF has text layer - use extracted text
      onProgress?.(50, 'Text layer extracted successfully');
      allPages = textPages;
      totalConfidence = 95; // High confidence for native PDF text
    } else {
      // PDF is scanned - perform OCR on each page
      onProgress?.(10, 'Detected scanned PDF - performing OCR...');
      
      for (let i = 1; i <= totalPages; i++) {
        const progress = 10 + (i / totalPages) * 80;
        onProgress?.(Math.round(progress), `Processing page ${i} of ${totalPages}...`);
        
        const page = await pdf.getPage(i);
        const canvas = await renderPageToCanvas(page, 2.0); // 2x scale for better OCR
        const blob = await canvasToBlob(canvas);
        
        const { text, confidence } = await ocrImage(blob);
        allPages.push(text);
        totalConfidence += confidence;
      }
      
      totalConfidence = totalConfidence / totalPages;
    }
    
    onProgress?.(95, 'Finalizing...');
    
    const fullText = allPages.join('\n\n--- PAGE BREAK ---\n\n');
    const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length;
    
    return {
      text: fullText,
      confidence: Math.round(totalConfidence),
      pages: allPages,
      wordCount,
      detectedLanguage: 'en',
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('PDF OCR Error:', error);
    throw new Error(`PDF OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Perform OCR on multiple pages of a PDF (alias for performPdfOCR)
 */
export const performMultiPageOCR = async (
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> => {
  return performPdfOCR(file, onProgress);
};

/**
 * Perform OCR on any supported document type
 */
export const performDocumentOCR = async (
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> => {
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  
  if (isPDF) {
    return performPdfOCR(file, onProgress);
  } else {
    return performOCR(file, onProgress);
  }
};

/**
 * Extract specific fields from a legal document (returns raw OCR text)
 * Note: Field parsing should be done by Gemini with the extracted text
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
  rawText?: string;
}> => {
  try {
    const result = await performDocumentOCR(file);
    
    // Return raw text - parsing will be done by Gemini
    return {
      rawText: result.text
    };
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
  
  const extension = file.n
