// Define a list of files to cache for offline use.
const cacheName = "app-cache-v1";
const filesToCache = [
    "/",
    "/index.html",
    "./assets/fonts/roboto/Roboto-msdf.js",
    "./assets/fonts/roboto/Roboto-msdf.json",
    "./assets/hdr/venice_sunset_1k.hdr",
    "./assets/images/",
    "./assets/dungeon.glb",
    "./assets/flare-gun.glb",
    "./assets/fred.glb",
    "./assets/ghoul.glb",
    "./assets/sfx",
    "./js/index.js",
    "./libs/three/three.module.js",
    "./libs/three/jsm/GLTFLoader.js",
    "./libs/three/jsm/RGBELoader.js",
    "./libs/three/jsm/XRControllerModelFactory.js",
    "./libs/three/jsm/three-pathfinding.module.js",
    "./libs/stats.module.js",
    "./libs/VRButton.js",
    "./libs/TeleportMesh.js",
    "./libs/Interactable.js",
    "./libs/Player.js",
    "./libs/LoadingBar.js",
];

// Install the service worker and cache the app's assets.
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(cacheName).then((cache) => {
            return cache.addAll(filesToCache);
        })
    );
});

// Activate the service worker and remove old caches.
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== cacheName) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Intercept network requests and serve cached assets if available.
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return the cached response if available; otherwise, fetch from the network.
            return response || fetch(event.request);
        })
    );
});
