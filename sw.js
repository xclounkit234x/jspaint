/* XK Paint service worker — offline app shell */
const CACHE = "xkpaint-shell-v1";
const PRECACHE = [
	"./",
	"./index.html",
	"./manifest.webmanifest",
	"./favicon.ico",
	"./styles/normalize.css",
	"./styles/layout.css",
	"./styles/void-neon.css",
	"./styles/void-tool-icons.css",
	"./styles/upgrade-overrides.css",
	"./styles/void-tabs.css",
	"./styles/themes/modern-dark.css",
	"./src/theme.js",
	"./src/void-quality.js",
	"./src/void-extras.js",
	"./src/void-vfs.js",
	"./src/void-tabs.js",
	"./src/interaction-fix.js",
	"./lib/jquery-3.4.1.min.js"
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
		).then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;

	// Navigations: network first, fall back to cache / index
	if (req.mode === "navigate") {
		event.respondWith(
			fetch(req)
				.then((res) => {
					const copy = res.clone();
					caches.open(CACHE).then((c) => c.put(req, copy));
					return res;
				})
				.catch(() =>
					caches.match(req).then((r) => r || caches.match("./index.html") || caches.match("./"))
				)
		);
		return;
	}

	// Assets: cache first, then network and populate cache
	event.respondWith(
		caches.match(req).then((cached) => {
			if (cached) return cached;
			return fetch(req)
				.then((res) => {
					if (res && res.ok && (url.pathname.startsWith("/styles") || url.pathname.startsWith("/src") || url.pathname.startsWith("/lib") || url.pathname.startsWith("/images"))) {
						const copy = res.clone();
						caches.open(CACHE).then((c) => c.put(req, copy));
					}
					return res;
				})
				.catch(() => cached);
		})
	);
});
