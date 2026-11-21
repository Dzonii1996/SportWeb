// Registruje service worker (src/service-worker.js) samo u produkciji:
// u razvoju (npm start) keširanje bi skrivalo izmene koda.
export const registerServiceWorker = () => {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL}/service-worker.js`)
      .catch((error) => console.error("Service worker nije registrovan:", error));
  });
};
