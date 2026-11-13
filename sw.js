// Service Worker: يحفظ التطبيق والمكتبة ليعمل بدون إنترنت
// (أوزان النموذج تحفظها مكتبة WebLLM نفسها في ذاكرة المتصفح)
const APP = "app-v4", LIB = "lib-v1";
const SHELL = ["./", "./index.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith("app-") && k !== APP || k.startsWith("lib-") && k !== LIB).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);

  // ملفات التطبيق: الشبكة أولاً (لتصل التحديثات) ثم الذاكرة عند انقطاع النت
  if (u.origin === location.origin) {
    e.respondWith(
      fetch(r).then(res => {
        const cp = res.clone();
        caches.open(APP).then(c => c.put(r, cp));
        return res;
      }).catch(() => caches.match(r, { ignoreSearch: true }).then(x => x || caches.match("./index.html")))
    );
    return;
  }

  // مكتبة WebLLM من jsDelivr: الذاكرة أولاً
  if (u.hostname === "esm.run" || u.hostname.endsWith("jsdelivr.net")) {
    e.respondWith(
      caches.open(LIB).then(async c => {
        const hit = await c.match(r);
        if (hit) return hit;
        const res = await fetch(r);
        if (res.ok) c.put(r, res.clone());
        return res;
      })
    );
  }
});
