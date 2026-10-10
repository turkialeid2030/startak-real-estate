// Text extraction only. The browser supplies the locally bundled library and
// worker; Node qualification uses the pinned library, never a remote URL.
const MAX_BYTES = 40 * 1024 * 1024;
const failure = code => Object.assign(new Error(code), { code });
export async function readPdfText(content, { loadPdfLibrary, signal, maxPages = 200,
  maxAtoms = 5000, maxCharacters = 1000000, timeoutMs = 20000 } = {}) {
  for (const [value, max] of [[maxPages,200],[maxAtoms,5000],[maxCharacters,1000000],[timeoutMs,20000]]) {
    if (!Number.isInteger(value) || value < 1 || value > max) throw failure('PDF_LIMIT_EXCEEDED');
  }
  const source = content instanceof ArrayBuffer ? new Uint8Array(content)
    : ArrayBuffer.isView(content) ? new Uint8Array(content.buffer,content.byteOffset,content.byteLength) : null;
  if (!source || source.byteLength > MAX_BYTES) throw failure('PDF_FILE_TOO_LARGE');
  if (signal?.aborted) throw failure('PDF_PARSER_ABORTED');
  let task, timer, abort;
  try {
    const library = loadPdfLibrary ? await loadPdfLibrary() : await (async () => {
      if (typeof process === 'undefined' || !process.versions?.node) throw failure('PDF_READER_UNAVAILABLE');
      const moduleName = 'pdfjs-dist/legacy/build/pdf.mjs';
      return import(/* @vite-ignore */ moduleName);
    })();
    if (signal?.aborted) throw failure('PDF_PARSER_ABORTED');
    task = library.getDocument({ data: source.slice(), isEvalSupported: false,
      useWorkerFetch: false, useWasm: false, disableFontFace: true, useSystemFonts: false,
      stopAtErrors: true, enableXfa: false, disableRange: true, disableStream: true,
      disableAutoFetch: true, maxImageSize: 0, verbosity: 0 });
    const stopped = new Promise((_,reject) => {
      abort = () => { reject(failure('PDF_PARSER_ABORTED')); void task.destroy().catch(() => {}); };
      signal?.addEventListener('abort',abort,{ once:true });
      timer = setTimeout(() => { reject(failure('PDF_PARSER_TIMEOUT')); void task.destroy().catch(() => {}); },timeoutMs);
    });
    const extracted = (async () => {
      const pdf = await task.promise;
      if (pdf.numPages > maxPages) throw failure('PDF_LIMIT_EXCEEDED');
      const lines = [], textlessPages = [];
      let characters = 0, itemCount = 0;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        if (signal?.aborted) throw failure('PDF_PARSER_ABORTED');
        const page = await pdf.getPage(pageNumber);
        const text = await page.getTextContent({ includeMarkedContent:false,disableNormalization:false });
        itemCount += text.items.length;
        if (itemCount > 50000) throw failure('PDF_LIMIT_EXCEEDED');
        let line = '', lineNumber = 0, previousY = null, found = false;
        const flush = () => {
          if (line.trim()) {
            lines.push({ text:line.trim(),page:pageNumber,line:++lineNumber }); found = true;
            if (lines.length > maxAtoms) throw failure('PDF_LIMIT_EXCEEDED');
          }
          line = '';
        };
        for (const item of text.items) {
          if (typeof item.str !== 'string') continue;
          characters += item.str.length;
          if (characters > maxCharacters) throw failure('PDF_LIMIT_EXCEEDED');
          const y = item.transform?.[5] ?? null;
          if (previousY !== null && y !== null && Math.abs(y-previousY)>2) flush();
          line += (line ? ' ' : '') + item.str;
          previousY = y;
          if (item.hasEOL) flush();
        }
        flush();
        if (!found) textlessPages.push(pageNumber);
        page.cleanup();
      }
      return { lines, pageCount:pdf.numPages,textlessPages,characters,libraryVersion:library.version };
    })();
    return await Promise.race([extracted,stopped]);
  } catch (error) {
    if (typeof error.code==='string' && error.code.startsWith('PDF_')) throw error;
    if (error.name === 'PasswordException') throw failure('PDF_PASSWORD_REQUIRED');
    if (error.name === 'InvalidPDFException' || error.name === 'FormatError' || error.name === 'UnknownErrorException') throw failure('PDF_INVALID_OR_CORRUPT');
    throw failure('PDF_READER_UNAVAILABLE');
  } finally {
    clearTimeout(timer);
    if (abort) signal?.removeEventListener('abort',abort);
    if (task) await task.destroy().catch(() => {});
  }
}
