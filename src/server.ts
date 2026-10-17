import worker from './index';

// Simple in-memory KV Namespace implementation with TTL support
class MemoryKV {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void> {
    const expiresAt = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async list(options?: {
    prefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }> {
    const now = Date.now();
    const keys: Array<{ name: string }> = [];
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
        continue;
      }
      if (!options?.prefix || key.startsWith(options.prefix)) {
        keys.push({ name: key });
      }
    }
    return {
      keys: options?.limit ? keys.slice(0, options.limit) : keys,
      list_complete: true,
    };
  }
}

const env = {
  TRANSCRIPT_CACHE: new MemoryKV() as any,
};

const ctx = {
  waitUntil(promise: Promise<any>) {
    promise.catch((err) => console.error('Background task error:', err));
  },
  passThroughOnException() {},
} as any;

const port = parseInt(process.env.PORT || '8080', 10);

console.log(`Starting YouTube Transcript MCP Server on port ${port}...`);

Bun.serve({
  port,
  idleTimeout: 255, // Allow long-lived SSE connections
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return worker.fetch(request, env, ctx);
  },
});
