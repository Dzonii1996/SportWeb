import { API_URL } from "../config";
import { authHeader } from "./auth";
import { localDateKey } from "./matchDate";

export const MAX_HOURS = 4;
export const MAX_DAYS_AHEAD = 60;

export const STATUS = {
  pending: { label: "Čeka potvrdu", className: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Potvrđena", className: "bg-green-100 text-green-800" },
  rejected: { label: "Odbijena", className: "bg-red-100 text-red-700" },
  cancelled: { label: "Otkazana", className: "bg-gray-200 text-gray-600" },
};

export const ACTIVE = ["pending", "confirmed"];

// "18:00"
export const hourLabel = (hour) => `${String(hour).padStart(2, "0")}:00`;

// Da li je sat [hour, hour+1) zauzet nekom rezervacijom; vraća tu rezervaciju ili null
export const busyAt = (hour, busy) =>
  busy.find((b) => hour >= b.start_hour && hour < b.end_hour) || null;

// Koliko najviše sati može da traje rezervacija od "start": do prvog zauzetog sata,
// zatvaranja ili MAX_HOURS. 0 znači da početak nije slobodan.
export const maxDurationFrom = (start, busy, closeHour, maxHours = MAX_HOURS) => {
  let hours = 0;

  while (hours < maxHours && start + hours < closeHour && !busyAt(start + hours, busy)) {
    hours += 1;
  }

  return hours;
};

// Početak rezervacije kao Date (lokalno vreme)
export const reservationStart = (r) => {
  const d = new Date(r.reservation_date);

  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), r.start_hour);
};

// "pet, 20. 11. 2026."
export const formatReservationDate = (date) =>
  new Date(date).toLocaleDateString("sr-Latn-RS", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

// Link za pravljenje termina vezanog za rezervaciju
export const createMatchUrl = (r) =>
  `/create-match?venue=${r.venue_id}&date=${localDateKey(r.reservation_date)}&time=${hourLabel(r.start_hour)}` +
  `&hours=${r.end_hour - r.start_hour}&reservation=${r.id}`;

// Akcija nad rezervacijom (confirm / reject / cancel); vraća true kad je uspela
export const reservationAction = async (id, name, reason) => {
  const res = await fetch(`${API_URL}/api/reservations/${id}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(reason ? { reason } : {}),
  });
  const data = await res.json();

  alert(data.message);

  return data.success;
};
