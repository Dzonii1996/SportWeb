import { useEffect, useState } from "react";
import { API_URL } from "../config";
import { authHeader } from "./auth";
import i18n from "../i18n";

// Iste vrednosti kao na serveru (controllers/venueController.js)
export const SURFACES = [
  "Veštačka trava",
  "Prirodna trava",
  "Parket",
  "Beton",
  "Asfalt",
  "Tartan",
  "Guma",
  "Ostalo",
];

export const MAX_IMAGES = 6;

export const sportIcons = (sports = []) =>
  sports.map((s) => (s === "Košarka" ? "🏀" : "⚽")).join(" ");

export const indoorLabel = (indoor) => (indoor ? i18n.t("venues.indoorsHall") : i18n.t("common.outdoors"));

export const imageUrl = (path) => `${API_URL}${path}`;

export const directionsUrl = (venue) =>
  `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;

const NO_STATUS = { isAdmin: false, pending: 0, pendingClaims: 0, ownedVenues: 0 };

// Da li je prijavljeni korisnik admin (koliko predloga i zahteva za vlasništvo čeka)
// i koliko terena poseduje. Bez prijave odmah vraća prazan status.
export const useAdminStatus = () => {
  const [status, setStatus] = useState({ ...NO_STATUS, loaded: false });

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      setStatus({ ...NO_STATUS, loaded: true });
      return;
    }

    fetch(`${API_URL}/api/venues/admin/status`, { headers: authHeader() })
      .then((res) => res.json())
      .then((data) =>
        setStatus({
          isAdmin: Boolean(data.is_admin),
          pending: data.pending_count || 0,
          pendingClaims: data.pending_claims || 0,
          ownedVenues: data.owned_venues || 0,
          loaded: true,
        })
      )
      .catch(() => setStatus({ ...NO_STATUS, loaded: true }));
  }, []);

  return status;
};

// Admin odobrava predlog; vraća true kad je uspelo
export const approveVenue = async (id) => {
  const res = await fetch(`${API_URL}/api/venues/${id}/approve`, {
    method: "POST",
    headers: authHeader(),
  });
  const data = await res.json();

  alert(data.message);

  return data.success;
};

// Admin odbija predlog uz razlog (nije obavezan); otkazivanje ne radi ništa
export const rejectVenue = async (id) => {
  const reason = window.prompt(i18n.t("venues.reasonForRejectionOptionalThe"), "");

  if (reason === null) return false;

  const res = await fetch(`${API_URL}/api/venues/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();

  alert(data.message);

  return data.success;
};

// Odobreni tereni za izbor u formi termina; null dok se učitavaju
export const useVenues = () => {
  const [venues, setVenues] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/venues`)
      .then((res) => res.json())
      .then((data) => setVenues(data.venues || []))
      .catch(() => setVenues([]));
  }, []);

  return venues;
};
