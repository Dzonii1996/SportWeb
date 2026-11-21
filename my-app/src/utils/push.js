import i18n from "../i18n";
import { API_URL } from "../config";
import { authHeader } from "./auth";

// Push obaveštenja na telefonu: pretplata ovog uređaja na serveru
// (server/services/pushService.js), a prikaz radi src/service-worker.js.

const PUSH_API = `${API_URL}/api/notifications/push`;

export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPad se predstavlja kao Mac, ali ima ekran na dodir
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Aplikacija je otvorena sa početnog ekrana, a ne u browseru
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

const isSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const registration = () => navigator.serviceWorker?.getRegistration();

const currentSubscription = async () => (await registration())?.pushManager.getSubscription() ?? null;

// "on" | "off" | "denied" | "install" (iPhone: prvo dodati na početni ekran) | "unsupported"
export const pushState = async () => {
  if (!isSupported()) return isIos() && !isStandalone() ? "install" : "unsupported";

  if (Notification.permission === "denied") return "denied";

  if (!(await registration())) return "unsupported";

  return (await currentSubscription()) ? "on" : "off";
};

// Ključ iz base64url u bajtove, kako ga traži pushManager.subscribe
const keyBytes = (base64) => {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");

  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

const saveOnServer = (subscription) =>
  fetch(`${PUSH_API}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ subscription: subscription.toJSON(), language: i18n.language }),
  }).then((res) => res.json());

// Mora se pozvati iz klika (iPhone inače ne pita za dozvolu). Vraća novo stanje,
// a greška sa servera ima poruku za korisnika u serverMessage.
export const enablePush = async () => {
  const permission = await Notification.requestPermission();

  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const { publicKey } = await fetch(`${PUSH_API}/key`, { headers: authHeader() }).then((res) => res.json());

  if (!publicKey) throw new Error("push-not-configured");

  const reg = await navigator.serviceWorker.ready;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));

  const data = await saveOnServer(subscription);

  if (!data.success) {
    await subscription.unsubscribe();
    throw Object.assign(new Error(data.message), { serverMessage: data.message });
  }

  return "on";
};

// headers: pri odjavi token se šalje pre nego što se obriše
export const disablePush = async (headers = authHeader()) => {
  const subscription = await currentSubscription();

  if (!subscription) return "off";

  await fetch(`${PUSH_API}/subscriptions`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
    keepalive: true,
  }).catch(() => {});

  await subscription.unsubscribe();

  return "off";
};

// Pri pokretanju i promeni jezika: server dobija aktuelnog korisnika i jezik ovog uređaja
export const syncPush = async () => {
  try {
    if (!isSupported() || Notification.permission !== "granted") return;

    const subscription = await currentSubscription();

    if (subscription) await saveOnServer(subscription);
  } catch {
    // Bez mreže: pokušaćemo pri sledećem otvaranju
  }
};
