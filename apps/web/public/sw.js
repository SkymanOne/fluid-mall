// Makes Fluid installable. Network only for now.
// ponytail: no offline cache, add one when the app needs to open without a connection.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
