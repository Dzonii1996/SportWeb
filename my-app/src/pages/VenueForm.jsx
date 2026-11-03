import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { LocationPicker } from "../components/LocationMap";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import {
  SURFACES,
  MAX_IMAGES,
  imageUrl,
  useAdminStatus,
} from "../utils/venues";

const EMPTY = {
  name: "",
  address: "",
  sports: ["Fudbal"],
  surface: "",
  indoor: false,
  price_per_hour: "",
  working_hours: "",
  phone: "",
  description: "",
};

const input = "w-full border p-3 rounded-xl";

// Predlog novog terena (korisnik), dodavanje (admin) i izmena (admin ili vlasnik, /tereni/:id/izmeni)
function VenueForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const { isAdmin } = useAdminStatus();

  const [form, setForm] = useState(EMPTY);
  const [position, setPosition] = useState(null);
  const [images, setImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [loaded, setLoaded] = useState(!editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;

    fetch(`${API_URL}/api/venues/${id}`, { headers: authHeader() })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || !data.can_edit) {
          setError("Samo admin ili vlasnik može da menja teren.");
        } else {
          const v = data.venue;

          setForm({
            name: v.name,
            address: v.address,
            sports: v.sports,
            surface: v.surface || "",
            indoor: v.indoor,
            price_per_hour: v.price_per_hour ?? "",
            working_hours: v.working_hours || "",
            phone: v.phone || "",
            description: v.description || "",
          });
          setPosition([v.latitude, v.longitude]);
          setImages(data.images);
        }

        setLoaded(true);
      });
  }, [editing, id]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const toggleSport = (sport) => {
    const sports = form.sports.includes(sport)
      ? form.sports.filter((s) => s !== sport)
      : [...form.sports, sport];

    setForm({ ...form, sports });
  };

  const freeSlots = MAX_IMAGES - images.length;

  const pickFiles = (e) => {
    const files = [...newFiles, ...e.target.files];

    if (files.length > freeSlots) {
      alert(`Teren može imati najviše ${MAX_IMAGES} slika.`);
    }

    setNewFiles(files.slice(0, freeSlots));
    e.target.value = "";
  };

  const deleteImage = async (image) => {
    if (!window.confirm("Obrisati sliku?")) return;

    const res = await fetch(`${API_URL}/api/venues/${id}/images/${image.id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    const data = await res.json();

    if (data.success) {
      setImages(images.filter((i) => i.id !== image.id));
    } else {
      alert(data.message);
    }
  };

  const uploadFiles = async (venueId) => {
    if (newFiles.length === 0) return true;

    const body = new FormData();
    newFiles.forEach((file) => body.append("images", file));

    const res = await fetch(`${API_URL}/api/venues/${venueId}/images`, {
      method: "POST",
      headers: authHeader(),
      body,
    });
    const data = await res.json();

    if (!data.success) {
      alert(`Teren je sačuvan, ali slike nisu: ${data.message}`);
    }

    return data.success;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!position) {
      alert("Označi teren na mapi (klikni na mesto gde se nalazi).");
      return;
    }

    if (form.sports.length === 0) {
      alert("Izaberi bar jedan sport.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/venues${editing ? `/${id}` : ""}`, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          ...form,
          latitude: position[0],
          longitude: position[1],
        }),
      });
      const data = await res.json();

      if (!data.success) {
        alert(data.message);
        return;
      }

      await uploadFiles(data.venue.id);

      alert(data.message);
      navigate(`/tereni/${data.venue.id}`);

    } catch (err) {
      alert("Greška pri čuvanju terena.");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <div className="text-center mt-20 text-xl">Učitavanje...</div>;
  }

  if (error) {
    return <div className="max-w-xl mx-auto p-6 text-center mt-10 text-xl">{error}</div>;
  }

  const title = editing ? "Izmeni teren" : isAdmin ? "Dodaj teren" : "Predloži teren";

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center py-10 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>

        {!editing && !isAdmin && (
          <p className="text-gray-600 mb-6">
            Predlog vidi admin i kad ga odobri, teren se pojavljuje na listi. Dobićeš obaveštenje.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <input
            className={input}
            placeholder="Naziv (npr. SC Sunce, sala OŠ Vuk Karadžić)"
            value={form.name}
            onChange={set("name")}
            required
            minLength={2}
            maxLength={100}
          />

          <input
            className={input}
            placeholder="Adresa"
            value={form.address}
            onChange={set("address")}
            required
            minLength={2}
            maxLength={200}
          />

          <LocationPicker value={position} onChange={setPosition} required />

          <div className="grid sm:grid-cols-2 gap-5">
            <fieldset>
              <legend className="font-medium mb-2">Sportovi</legend>
              <div className="flex gap-4">
                {["Fudbal", "Košarka"].map((sport) => (
                  <label key={sport} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.sports.includes(sport)}
                      onChange={() => toggleSport(sport)}
                      className="w-4 h-4"
                    />
                    {sport === "Fudbal" ? "⚽ Fudbal" : "🏀 Košarka"}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="font-medium mb-2">Gde</legend>
              <div className="flex gap-4">
                {[
                  [false, "🌤️ Napolju"],
                  [true, "🏠 Unutra"],
                ].map(([value, label]) => (
                  <label key={label} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="indoor"
                      checked={form.indoor === value}
                      onChange={() => setForm({ ...form, indoor: value })}
                      className="w-4 h-4"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <select className={input} value={form.surface} onChange={set("surface")}>
              <option value="">Podloga (nije obavezno)</option>
              {SURFACES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div className="flex items-center border rounded-xl pr-4 focus-within:ring-2 focus-within:ring-green-600">
              <input
                type="number"
                min="0"
                max="1000000"
                step="1"
                value={form.price_per_hour}
                onChange={set("price_per_hour")}
                placeholder="Okvirna cena po satu"
                className="w-full p-3 rounded-xl outline-none"
              />
              <span className="text-gray-500 whitespace-nowrap">din/h</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <input
              className={input}
              placeholder="Radno vreme (npr. svaki dan 8–23h)"
              value={form.working_hours}
              onChange={set("working_hours")}
              maxLength={200}
            />

            <input
              className={input}
              type="tel"
              placeholder="Telefon za rezervaciju (nije obavezno)"
              value={form.phone}
              onChange={set("phone")}
              maxLength={30}
            />
          </div>

          <textarea
            className={input}
            rows={4}
            placeholder="Opis: osvetljenje, svlačionice, parking..."
            value={form.description}
            onChange={set("description")}
            maxLength={2000}
          />

          {/* Slike */}
          <div>
            <p className="font-medium mb-1">Slike (najviše {MAX_IMAGES}, JPG/PNG/WEBP do 5 MB)</p>
            <p className="text-sm text-gray-500 mb-2">
              Samo sopstvene fotografije, ne slike sa tuđih sajtova.
            </p>

            {(images.length > 0 || newFiles.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-2">
                {images.map((img) => (
                  <div key={img.id} className="relative">
                    <img src={imageUrl(img.path)} alt="" className="w-24 h-16 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => deleteImage(img)}
                      aria-label="Obriši sliku"
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {newFiles.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      className="w-24 h-16 object-cover rounded-lg opacity-80"
                    />
                    <button
                      type="button"
                      onClick={() => setNewFiles(newFiles.filter((_, j) => j !== i))}
                      aria-label="Ukloni sliku"
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-700 text-white flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {newFiles.length < freeSlots && (
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={pickFiles}
                className="text-sm"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold"
          >
            {saving ? "Čuvam..." : editing ? "Sačuvaj izmene" : isAdmin ? "Dodaj teren" : "Pošalji predlog"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default VenueForm;
