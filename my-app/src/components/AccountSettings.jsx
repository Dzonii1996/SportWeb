import { useState } from "react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";

const input = "w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600";

// Status poruka ispod forme: { ok: true/false, text }
const Status = ({ status }) =>
  status ? (
    <p className={`text-sm ${status.ok ? "text-green-700" : "text-red-600"}`}>
      {status.text}
    </p>
  ) : null;

// Izmena imena i lozinke na stranici Profil
function AccountSettings({ user, onNameChange }) {
  const [name, setName] = useState(user.name);
  const [nameStatus, setNameStatus] = useState(null);

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordStatus, setPasswordStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const request = (path, body) =>
    fetch(`${API_URL}/api/users/${user.id}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(body),
    }).then((res) => res.json());

  const saveName = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = await request("", { name });

      setNameStatus({ ok: data.success, text: data.message });

      if (data.success) {
        // NavBar čita ime iz localStorage
        const stored = JSON.parse(localStorage.getItem("user"));
        localStorage.setItem("user", JSON.stringify({ ...stored, name: data.user.name }));
        window.dispatchEvent(new Event("storage"));
        onNameChange(data.user.name);
      }
    } catch {
      setNameStatus({ ok: false, text: "Greška pri povezivanju sa serverom." });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();

    if (passwords.next !== passwords.confirm) {
      setPasswordStatus({ ok: false, text: "Nove lozinke se ne poklapaju." });
      return;
    }

    setSaving(true);

    try {
      const data = await request("/password", {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });

      setPasswordStatus({ ok: data.success, text: data.message });

      if (data.success) {
        // Stari token više ne važi; ovaj uređaj ostaje prijavljen novim
        localStorage.setItem("token", data.token);
        setPasswords({ current: "", next: "", confirm: "" });
      }
    } catch {
      setPasswordStatus({ ok: false, text: "Greška pri povezivanju sa serverom." });
    } finally {
      setSaving(false);
    }
  };

  const setPassword = (field) => (e) =>
    setPasswords({ ...passwords, [field]: e.target.value });

  return (
    <div className="border-t pt-8 mt-8 space-y-8">
      <h2 className="text-2xl font-bold">⚙️ Podešavanja naloga</h2>

      <form onSubmit={saveName} className="space-y-3">
        <label className="block font-semibold">Ime</label>

        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={100}
            className={input}
          />

          <button
            type="submit"
            disabled={saving || name.trim() === user.name}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-5 rounded-xl font-semibold"
          >
            Sačuvaj
          </button>
        </div>

        <Status status={nameStatus} />
      </form>

      <form onSubmit={savePassword} className="space-y-3">
        <label className="block font-semibold">Promena lozinke</label>

        <input
          type="password"
          value={passwords.current}
          onChange={setPassword("current")}
          required
          placeholder="Trenutna lozinka"
          autoComplete="current-password"
          className={input}
        />

        <input
          type="password"
          value={passwords.next}
          onChange={setPassword("next")}
          required
          minLength={6}
          placeholder="Nova lozinka (najmanje 6 znakova)"
          autoComplete="new-password"
          className={input}
        />

        <input
          type="password"
          value={passwords.confirm}
          onChange={setPassword("confirm")}
          required
          minLength={6}
          placeholder="Ponovi novu lozinku"
          autoComplete="new-password"
          className={input}
        />

        <Status status={passwordStatus} />

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold"
        >
          Promeni lozinku
        </button>

        <p className="text-sm text-gray-500">
          Posle promene lozinke biće odjavljeni svi ostali uređaji.
        </p>
      </form>
    </div>
  );
}

export default AccountSettings;
