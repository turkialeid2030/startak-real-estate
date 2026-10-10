import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
// Vite emits a same-origin asset. No CDN, external-font, OCR, or AI requests.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export const loadPdfLibrary = async () => pdfjs;
