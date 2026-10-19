'use strict';

// Bound bytes before decoding; Content-Length alone is not trustworthy.
async function readBoundedJson(response, maxBytes = 65536, signal) {
  if (Number(response.headers?.get('content-length')) > maxBytes) throw new Error('RESPONSE_TOO_LARGE');
  if (!response.body?.getReader) {
    const value = await response.json();
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maxBytes) throw new Error('RESPONSE_TOO_LARGE');
    return value;
  }
  const reader = response.body.getReader();
  const onAbort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
  if (signal?.aborted) throw new Error('REQUEST_CANCELLED');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

module.exports = { readBoundedJson };
