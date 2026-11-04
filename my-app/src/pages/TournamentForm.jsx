import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import VenuePicker from "../components/VenuePicker";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { localDateKey, todayKey, maxDateKey } from "../utils/matchDate";
import { useAdminStatus, useVenues } from "../utils/venues";
import { FORMATS } from "../utils/tournaments";

const input = "w-full border p-3 rounded-xl";

// Pravljenje turnira (/turniri/novi) i izmena dok traju prijave (/turniri/:id/izmeni)
function TournamentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const me = JSON.parse(localStorage.getItem("user") || "null");
  const { isAdmin, ownedVenues, loaded: statusLoaded } = useAdminStatus();
  const allVenues = useVenues();
  // Vlasnik pravi turnire samo na svojim terenima
  const venues = isAdmin
    ? allVenues
    : allVenues?.filter((v) => Number(v.owner_id) === Number(me?.id));

  const [form, setForm] = useState({
    name: "",
    sport: "Fudbal",
    format: "league",
    location: "",
    start_date: "",
    max_teams: 8,
    max_roster: 10,
    entry_fee: "",
    rules: "",
  });
  const [venueId, setVenueId] = useState("");
  const [venueName, setVenueName] = useState(null);
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;

    fetch(`${API_URL}/api/tournaments/${id}`, { headers: authHeader() })
      .then((res) => res.json())
      .then((data) => {
        const t = data.tournament;

        if (!data.success || !data.can_manage) {
          setError("Samo organizator može da menja turnir.");
        } else if (t.status !== "registration") {
          setError("Turnir može da se menja samo dok traju prijave.");
        } else {
          setForm({
            name: t.name,
            sport: t.sport,
            format: t.format,
            location: t.location,
            start_date: localDateKey(t.start_date),
            max_teams: t.max_teams,
            max_roster: t.max_roster,
            entry_fee: t.entry_fee ?? "",
            rules: t.rules || "",
          });
          setVenueId(t.venue_id ? String(t.venue_id) : "");
          setVenueName(t.location);
        }

        setLoaded(true);
      });
  }, [editing, id]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const selectVenue = (venue) => {
    setVenueId(venue ? String(venue.id) : "");

    if (venue) setForm((f) => ({ ...f, location: venue.name }));
  };

  // Promena sporta: teren koji nije za taj sport se poništava
  const changeSport = (e) => {
    const venue = venues?.find((v) => String(v.id) === venueId);

    if (venue && !venue.sports.includes(e.target.value)) setVenueId("");

    set("sport")(e);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAdmin && !venueId) {
      alert("Izaberi svoj teren.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/tournaments${editing ? `/${id}` : ""}`, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ ...form, venue_id: venueId || null }),
      });
      const data = await res.json();

      alert(data.message);

      if (data.success) navigate(`/turniri/${data.tournament.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded || !statusLoaded) {
    return <div className="text-center mt-20 text-xl">Učitavanje...</div>;
  }

  if (!editing && !isAdmin && ownedVenues === 0) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center mt-10 text-xl">
        Turnire prave admin i vlasnici terena.
      </div>
    );
  }

  if (error) {
    return <div className="max-w-xl mx-auto p-6 text-center mt-10 text-xl">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center py-10 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">{editing ? "Izmeni turnir" : "Napravi turnir"}</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            className={input}
            placeholder="Naziv turnira (npr. Letnji kup 2027)"
            value={form.name}
            onChange={set("name")}
            required
            minLength={3}
            maxLength={100}
          />

          <select className={input} value={form.sport} onChange={changeSport} aria-label="Sport">
            <option value="Fudbal">⚽ Fudbal</option>
            <option value="Košarka">🏀 Košarka</option>
          </select>

          <fieldset>
            <legend className="font-medium mb-2">Format</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.entries(FORMATS).map(([value, format]) => (
                <label
                  key={value}
                  className={`border rounded-xl p-3 cursor-pointer ${
                    form.format === value ? "border-green-600 bg-green-50" : "border-gray-200"
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <input
                      type="radio"
                      name="format"
                      checked={form.format === value}
                      onChange={() => setForm({ ...form, format: value })}
                      className="w-4 h-4"
                    />
                    {format.label}
                  </span>
                  <span className="block text-sm text-gray-600 mt-1">{format.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <VenuePicker
            venues={venues}
            sport={form.sport}
            value={venueId}
            onChange={selectVenue}
            currentName={venueName}
          />

          {!venueId && isAdmin && (
            <input
              className={input}
              placeholder="Lokacija"
              value={form.location}
              onChange={set("location")}
              required
              minLength={2}
              maxLength={100}
            />
          )}

          <label className="block">
            <span className="font-medium">Datum početka</span>
            <input
              type="date"
              className={`${input} mt-1`}
              value={form.start_date}
              onChange={set("start_date")}
              required
              min={todayKey()}
              max={maxDateKey()}
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-5">
            <label className="block">
              <span className="font-medium">Najviše ekipa</span>
              <input
                type="number"
                className={`${input} mt-1`}
                value={form.max_teams}
                onChange={set("max_teams")}
                required
                min="2"
                max="32"
              />
            </label>

            <label className="block">
              <span className="font-medium">Najviše igrača u ekipi</span>
              <input
                type="number"
                className={`${input} mt-1`}
                value={form.max_roster}
                onChange={set("max_roster")}
                required
                min="1"
                max="30"
              />
            </label>
          </div>

          <div className="flex items-center border rounded-xl pr-4 focus-within:ring-2 focus-within:ring-green-600">
            <input
              type="number"
              min="0"
              max="1000000"
              step="1"
              value={form.entry_fee}
              onChange={set("entry_fee")}
              placeholder="Kotizacija po ekipi (nije obavezno)"
              className="w-full p-3 rounded-xl outline-none"
            />
            <span className="text-gray-500">din</span>
          </div>

          <textarea
            className={input}
            rows={4}
            maxLength={2000}
            placeholder="Pravila: trajanje utakmica, broj igrača na terenu, oprema..."
            value={form.rules}
            onChange={set("rules")}
          />

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold"
          >
            {saving ? "Čuvam..." : editing ? "Sačuvaj izmene" : "Napravi turnir"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TournamentForm;
