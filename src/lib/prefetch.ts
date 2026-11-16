// Route chunk loaders shared between React.lazy and hover/focus intent preloading
export const routeChunkLoaders = {
  catalog: () => import('../pages/CatalogPage'),
  product: () => import('../pages/ProductDetailPage'),
  cart: () => import('../pages/CartPage'),
  checkout: () => import('../pages/CheckoutPage'),
  inquiry: () => import('../pages/InquiryPage'),
  quotation: () => import('../pages/QuotationViewPage'),
  staticPage: () => import('../pages/StaticPage'),
  account: () => import('../pages/AccountPage'),
  admin: () => import('../pages/AdminDashboard'),
};

const preloadedChunks = new Set<keyof typeof routeChunkLoaders>();

export function preloadRouteChunk(key: keyof typeof routeChunkLoaders): void {
  if (preloadedChunks.has(key)) return;
  preloadedChunks.add(key);
  routeChunkLoaders[key]().catch(() => {
    preloadedChunks.delete(key);
  });
}

// Stale-while-revalidate bounded in-memory query cache + in-flight deduplication
interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

const MAX_CACHE_ENTRIES = 80;
const DEFAULT_TTL_MS = 60_000;

const queryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const warmedImages = new Set<string>();

export function getCachedQuery<T = unknown>(url: string, maxAgeMs = DEFAULT_TTL_MS): T | null {
  const entry = queryCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) return null;
  return entry.data as T;
}

export function setCachedQuery<T = unknown>(url: string, data: T): void {
  if (queryCache.has(url)) queryCache.delete(url);
  queryCache.set(url, { data, timestamp: Date.now() });
  if (queryCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) queryCache.delete(oldestKey);
  }
}

export function clearQueryCache(): void {
  queryCache.clear();
}

export async function fetchCachedQuery<T = unknown>(
  url: string,
  options?: { force?: boolean; ttlMs?: number; onRevalidate?: (fresh: T) => void }
): Promise<T> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const cached = !options?.force ? queryCache.get(url) : undefined;

  if (cached && Date.now() - cached.timestamp <= ttlMs) {
    // Serve immediately from cache; if older than 15s, silently refresh in background
    if (Date.now() - cached.timestamp > 15_000 && !inFlightRequests.has(url)) {
      void networkFetchAndCache<T>(url).then((fresh) => {
        options?.onRevalidate?.(fresh);
      }).catch(() => {});
    }
    return cached.data as T;
  }

  return networkFetchAndCache<T>(url);
}

async function networkFetchAndCache<T>(url: string): Promise<T> {
  const existing = inFlightRequests.get(url);
  if (existing) return existing as Promise<T>;

  const req = fetch(url)
    .then(async (res) => {
      if (res.status === 404) {
        const err = new Error('NOT_FOUND');
        (err as Error & { status?: number }).status = 404;
        throw err;
      }
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      const data = (await res.json()) as T;
      setCachedQuery(url, data);
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(url);
    });

  inFlightRequests.set(url, req);
  return req;
}

export function prefetchImage(src?: string | null): void {
  if (!src || warmedImages.has(src) || typeof window === 'undefined') return;
  warmedImages.add(src);
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
}

export function prefetchProduct(slug: string, imageUrl?: string | null): void {
  if (!slug) return;
  preloadRouteChunk('product');
  prefetchImage(imageUrl);
  const url = `/api/products/${slug}`;
  if (!getCachedQuery(url, 45_000) && !inFlightRequests.has(url)) {
    void networkFetchAndCache(url).catch(() => {});
  }
}

export function prefetchCatalog(params?: { category?: string; brand?: string; sort?: string }): void {
  preloadRouteChunk('catalog');
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.brand) qs.set('brand', params.brand);
  qs.set('sort', params?.sort || 'featured');
  qs.set('page', '1');
  qs.set('limit', '12');
  const url = `/api/products?${qs.toString()}`;
  if (!getCachedQuery(url, 45_000) && !inFlightRequests.has(url)) {
    void networkFetchAndCache(url).catch(() => {});
  }
}

export function prefetchPage(slug: string): void {
  if (!slug) return;
  preloadRouteChunk('staticPage');
  const url = `/api/pages/${slug}`;
  if (!getCachedQuery(url, 60_000) && !inFlightRequests.has(url)) {
    void networkFetchAndCache(url).catch(() => {});
  }
}
