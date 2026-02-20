import '@testing-library/jest-dom/vitest';

// Polyfill for DOMMatrix which is missing in JSDOM but required by pdfjs-dist
if (typeof window !== 'undefined' && !window.DOMMatrix) {
  (window as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(init?: string | number[]) {
      if (Array.isArray(init) && init.length >= 6) {
        this.a = init[0]; this.b = init[1]; this.c = init[2];
        this.d = init[3]; this.e = init[4]; this.f = init[5];
      }
    }
  };
}

// Mock URL.createObjectURL and revokeObjectURL
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'mock-url');
  window.URL.revokeObjectURL = vi.fn();
}

// Mock Worker
if (typeof window !== 'undefined' && !window.Worker) {
  (window as any).Worker = class Worker {
    onmessage = null;
    onerror = null;
    postMessage() {}
    terminate() {}
    addEventListener() {}
    removeEventListener() {}
  };
}
