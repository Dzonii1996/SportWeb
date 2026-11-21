/* eslint-disable no-restricted-globals */

// Service worker instalirane aplikacije (PWA). Build (react-scripts) ga pravi
// samo za produkciju i u njega upisuje spisak fajlova aplikacije (__WB_MANIFEST).
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

// Nova verzija preuzima odmah: aplikacija nema delove koji se učitavaju naknadno,
// pa otvorena stranica radi do kraja sa starim fajlovima, a sledeće otvaranje dobija nove
self.skipWaiting();
clientsClaim();

// JS, CSS, fontovi i ikonice su sačuvani na telefonu, pa se aplikacija otvara i bez mreže
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Sve stranice aplikacije (/matches/5, /turniri...) su isti index.html; podatke i dalje
// donosi server, a API je na drugoj adresi i ovaj worker ga ne dira
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${process.env.PUBLIC_URL}/index.html`)));

// Push sa servera (utils/push.js): { title, body, url }
self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "Sport KM", {
        body: data.body || "",
        icon: "/logo192.png",
        data: { url: data.url || "/" },
      });

      // Otvorena aplikacija odmah osvežava broj u zvoncu
      const windows = await self.clients.matchAll({ type: "window" });
      windows.forEach((client) => client.postMessage({ type: "push" }));
    })()
  );
});

// Dodir na obaveštenje otvara stranicu na koju se odnosi
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);

      if (open) {
        await open.focus();
        return open.navigate(url);
      }

      return self.clients.openWindow(url);
    })()
  );
});
