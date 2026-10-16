import { reserveQuota, settleQuota } from './quota.mjs';
import { readBoundedText } from '../../functions/api/riai/_bounded-body.mjs';

export class RiaiQuota {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    try {
      const input = JSON.parse(await readBoundedText(request, { maxBytes: 4096, timeoutMs: 3000 }));
      const route = new URL(request.url).pathname;
      const result = route === '/reserve' ? await reserveQuota(this.storage, { ...input, now: Date.now() })
        : route === '/settle' ? await settleQuota(this.storage, input) : null;
      return result ? Response.json(result) : new Response(null, { status: 404 });
    } catch (_) { return Response.json({ allowed: false, code: 'INVALID_QUOTA_REQUEST' }, { status: 400 }); }
  }
}

// Namespace binding only: never expose reservation/settlement on a public route.
export default { fetch() { return new Response(null, { status: 403 }); } };
