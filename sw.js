const CACHE_NAME = 'yorushika-calendar-v2';

// Core app shell & external dependencies required so the app opens cleanly offline
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './whiteyoru.png',
    './blackyoru.png',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..700;1,400..700&display=swap'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await Promise.allSettled(
                PRECACHE_ASSETS.map(async (asset) => {
                    try {
                        const request = new Request(asset, { cache: 'reload' });
                        const response = await fetch(request);
                        if (response && (response.status === 200 || response.type === 'opaque')) {
                            await cache.put(asset, response);
                        }
                    } catch (err) {
                        console.warn('[SW] Precache skipped:', asset, err);
                    }
                })
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                )
            )
            .then(() => self.clients.claim())
    );
});

// Helper: find any cached HTML document if exact URL miss occurs (e.g. custom filename)
async function getOfflineHtmlFallback(request) {
    const cache = await caches.open(CACHE_NAME);

    const exactMatch = await cache.match(request, { ignoreSearch: true });
    if (exactMatch) return exactMatch;

    const indexMatch = await cache.match('./index.html') || await cache.match('./');
    if (indexMatch) return indexMatch;

    const keys = await cache.keys();
    for (const key of keys) {
        const pathname = new URL(key.url).pathname;
        if (pathname.endsWith('.html') || pathname.endsWith('/')) {
            const candidate = await cache.match(key);
            if (candidate) return candidate;
        }
    }

    return new Response(
        '<!doctype html><html><body style="background:#141413;color:#e3ded8;font-family:serif;padding:24px;text-align:center;"><h3>Offline</h3><p>Open the app once while online so the offline cache is stored.</p></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Let Supabase REST & Auth calls bypass SW so offline sync queue handles them directly
    if (url.hostname.includes('supabase.co')) return;

    const acceptHeader = event.request.headers.get('accept') || '';
    const isPageRequest =
        event.request.mode === 'navigate' ||
        acceptHeader.includes('text/html') ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('/');

    if (isPageRequest) {
        event.respondWith(
            fetch(event.request)
                .then(async (networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const cache = await caches.open(CACHE_NAME);
                        await cache.put(event.request, networkResponse.clone());
                        // Also mirror to ./index.html & ./ so root/filename navigation resolves offline
                        await cache.put('./index.html', networkResponse.clone());
                        await cache.put('./', networkResponse.clone());
                    }
                    return networkResponse;
                })
                .catch(() => getOfflineHtmlFallback(event.request))
        );
        return;
    }

    // Stale-while-revalidate for scripts, fonts, and static assets
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request, { ignoreSearch: false });

            const networkFetch = fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                })
                .catch(() => null);

            if (cachedResponse) {
                event.waitUntil(networkFetch);
                return cachedResponse;
            }

            const freshResponse = await networkFetch;
            if (freshResponse) return freshResponse;

            return new Response('', { status: 504, statusText: 'Offline asset unavailable' });
        })
    );
});
