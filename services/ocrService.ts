import * as Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { OCRResult } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + pdfjsLib.version + '/pdf.worker.min.js';

let tesseractWorker: Tesseract.Worker | null = null;

const getTesseractWorker = async (): Promise<Tesseract.Worker> => {
  if (!tesseractWorker) {
    tesseractWorker = await Tesseract.createWorker('eng', 1);
  }
  return tesseractWorker;
};

const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
};

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
    viewport,
    canvas
  }).promise;
  
  return canvas;
};

const ocrImage = async (
  image: Blob | HTMLCanvasElement | string
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

const extractPdfText = async (pdf: pdfjsLib.PDFDocumentProxy): Promise<string[]> => {
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

export const performOCR = async (file: File): Promise<OCRResult> => {
  const startTime = Date.now();
  
  try {
    const { text, confidence } = await ocrImage(file);
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
    
    const textPages = await extractPdfText(pdf);
    
    const totalTextLength = textPages.reduce((sum, p) => sum + p.length, 0);
    const needsOCR = totalTextLength < totalPages * 100;
    
    let allPages: string[] = [];
    let totalConfidence = 0;
    
    if (!needsOCR) {
      onProgress?.(50, 'Text layer extracted successfully');
      allPages = textPages;
      totalConfidence = 95;
    } else {
      onProgress?.(10, 'Detected scanned PDF - performing OCR...');
      
      for (let i = 1; i <= totalPages; i++) {
        const progress = 10 + (i / totalPages) * 80;
        onProgress?.(Math.round(progress), `Processing page ${i} of ${totalPages}...`);
        
        const page = await pdf.getPage(i);
        const canvas = await renderPageToCanvas(page, 2.0);
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

export const performMultiPageOCR = performPdfOCR;

export const performDocumentOCR = async (
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> => {
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  
  if (isPDF) {
    return performPdfOCR(file, onProgress);
  } else {
    return performOCR(file);
  }
};

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
    
    return {
      rawText: result.text
    };
  } catch (error) {
    console.error('Field extraction error:', error);
    return {};
  }
};

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
  
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeTypeValid = validTypes.includes(file.type);
  const extensionValid = validExtensions.includes(extension);
  
  if (!mimeTypeValid && !extensionValid) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type || extension}. Supported formats: PDF, PNG, JPG, JPEG, TIFF, BMP, WEBP, GIF`
    };
  }
  
  return { valid: true };
};

export const terminateOCR = async (): Promise<void> => {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
};
