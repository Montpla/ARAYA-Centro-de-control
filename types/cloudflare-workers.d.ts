interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1Database {
  readonly __d1DatabaseRuntimeBrand: unique symbol;
}

declare module "cloudflare:workers" {
  // Bindings are supplied by the Sites runtime. Individual routes narrow the
  // non-database binding they use before reading or writing it.
  export const env: {
    DB: D1Database;
    [binding: string]: unknown;
  };
}
