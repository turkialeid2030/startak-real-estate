// Bound both streamed bytes and wall-clock time, including stalled response bodies.
export async function readBoundedText(message, { maxBytes, timeoutMs, signal } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('INVALID_READ_LIMIT');
  const reader = message.body?.getReader();
  if (!reader) return '';
  let timer;
  let abort;
  let completed = false;
  const failure = (code) => Object.assign(new Error(code), { code });
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(failure('BODY_READ_TIMEOUT')), timeoutMs);
    abort = () => reject(failure('BODY_READ_ABORTED'));
    signal?.addEventListener('abort', abort, { once: true });
  });
  try {
    if (signal?.aborted) throw failure('BODY_READ_ABORTED');
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let text = '';
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) {
        text += decoder.decode();
        completed = true;
        return text;
      }
      bytes += value.byteLength;
      if (bytes > maxBytes) throw failure('BODY_TOO_LARGE');
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    // Cancellation itself may be stalled by the upstream; never await it.
    if (!completed) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
