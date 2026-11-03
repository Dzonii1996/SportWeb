import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import {
  sportIcons,
  indoorLabel,
  imageUrl,
  useAdminStatus,
  approveVenue,
  rejectVenue,
} from "../utils/venues";

const TABS = [
  { value: "pending", label: "Na čekanju" },
  { value: "rejected", label: "Odbijeni" },
  { value: "claims", label: "Vlasništvo" },
];

// Admin odobrava ili odbija zahtev za vlasništvo; vraća true kad je uspelo
const decideClaim = async (claim, action) => {
  if (
    action === "approve" &&
    !window.confirm(`${claim.user_name} (${claim.user_email}) postaje vlasnik terena "${claim.venue_name}"?`)
  ) {
    return false;
  }

  const res = await fetch(`${API_URL}/api/venues/claims/${claim.id}/${action}`, {
    method: "POST",
    headers: authHeader(),
  });
  const data = await res.json();

  alert(data.message);

  return data.success;
};

// Admin: pregled predloga terena i zahteva za vlasništvo
function VenueAdmin() {
  const { isAdmin, loaded } = useAdminStatus();
  const [status, setStatus] = useState("pending");
  const [venues, setVenues] = useState([]);
  const [claims, setClaims] = useState([]);

  const load = useCallback(() => {
    if (status === "claims") {
      fetch(`${API_URL}/api/venues/admin/claims`, { headers: authHeader() })
        .then((res) => res.json())
        .then((data) => setClaims(data.claims || []))
        .catch((error) => console.error(error));
      return;
    }

    fetch(`${API_URL}/api/venues/admin/list?status=${status}`, { headers: authHeader() })
      .then((res) => res.json())
      .then((data) => setVenues(data.venues || []))
      .catch((error) => console.error(error));
  }, [status]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!loaded) {
    return <div className="text-center mt-20 text-xl">Učitavanje...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center mt-10">
        <p className="text-xl">Ova stranica je samo za admina.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-5xl mx-auto p-6">
        <Link to="/tereni" className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft size={18} />
          Svi tereni
        </Link>

        <h1 className="text-3xl font-bold mb-6">Predlozi i vlasnici terena</h1>

        <div className="flex gap-2 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`px-4 py-2 rounded-full font-semibold transition ${
                status === tab.value ? "bg-green-600 text-white" : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {status === "claims" ? (
          claims.length === 0 ? (
            <p className="text-gray-600 bg-white rounded-2xl border p-6 text-center">
              Nema zahteva za vlasništvo.
            </p>
          ) : (
            <div className="space-y-4">
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <Link to={`/tereni/${claim.venue_id}`} className="text-xl font-bold hover:text-green-700">
                      {claim.venue_name}
                    </Link>
                    <p className="text-gray-600">{claim.venue_address}</p>
                    <p className="mt-2">
                      <span className="font-semibold">{claim.user_name}</span>{" "}
                      <span className="text-gray-500">({claim.user_email})</span>
                    </p>
                    {claim.message && (
                      <p className="mt-1 text-gray-700 whitespace-pre-line break-words">„{claim.message}“</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(claim.created_at).toLocaleDateString("sr-Latn-RS")}
                    </p>
                  </div>

                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <button
                      onClick={async () => (await decideClaim(claim, "approve")) && load()}
                      className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
                    >
                      Odobri
                    </button>
                    <button
                      onClick={async () => (await decideClaim(claim, "reject")) && load()}
                      className="px-4 py-2 rounded-xl border border-red-300 text-red-700 font-semibold hover:bg-red-50"
                    >
                      Odbij
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : venues.length === 0 ? (
          <p className="text-gray-600 bg-white rounded-2xl border p-6 text-center">
            {status === "pending" ? "Nema predloga na čekanju. 🎉" : "Nema odbijenih predloga."}
          </p>
        ) : (
          <div className="space-y-4">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-4"
              >
                {venue.cover_image ? (
                  <img
                    src={imageUrl(venue.cover_image)}
                    alt={venue.name}
                    className="w-full sm:w-40 h-28 object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full sm:w-40 h-28 rounded-xl bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center text-3xl">
                    {sportIcons(venue.sports)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold">{venue.name}</h2>
                  <p className="text-gray-600">{venue.address}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {venue.sports.join(", ")} · {indoorLabel(venue.indoor)}
                    {venue.surface && ` · ${venue.surface}`}
                  </p>
                  <p className="text-sm text-gray-500">
                    Predložio/la: {venue.suggested_by_name || "nepoznat korisnik"},{" "}
                    {new Date(venue.created_at).toLocaleDateString("sr-Latn-RS")}
                  </p>
                  {venue.rejection_reason && (
                    <p className="text-sm text-red-700 mt-1">Razlog: {venue.rejection_reason}</p>
                  )}
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0">
                  <Link
                    to={`/tereni/${venue.id}`}
                    className="text-center px-4 py-2 rounded-xl border border-gray-200 font-medium hover:bg-gray-50"
                  >
                    Pogledaj
                  </Link>
                  <button
                    onClick={async () => (await approveVenue(venue.id)) && load()}
                    className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
                  >
                    Odobri
                  </button>
                  {status === "pending" && (
                    <button
                      onClick={async () => (await rejectVenue(venue.id)) && load()}
                      className="px-4 py-2 rounded-xl border border-red-300 text-red-700 font-semibold hover:bg-red-50"
                    >
                      Odbij
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VenueAdmin;
