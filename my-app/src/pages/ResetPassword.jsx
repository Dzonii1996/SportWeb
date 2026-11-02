import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { API_URL } from "../config";

// Stranica iz linka u mejlu: /reset-password?token=...
function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Lozinke se ne poklapaju.");
      return;
    }

    setSending(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (data.success) {
        setDone(true);
      } else {
        setError(data.message);
      }

    } catch (err) {
      console.error(err);
      setError("Greška pri povezivanju sa serverom.");
    } finally {
      setSending(false);
    }
  };

  const field = (value, onChange, placeholder) => (
    <div className="flex items-center border rounded-xl px-3">
      <Lock className="text-gray-400" size={20} />
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={6}
        placeholder={placeholder}
        className="w-full p-3 outline-none"
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-600 to-green-800 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">

        <h1 className="text-3xl font-bold text-gray-800 text-center mb-8">
          Nova lozinka
        </h1>

        {!token ? (
          <p className="text-center text-red-600">
            Link nije ispravan. Otvori ga ponovo iz mejla.
          </p>
        ) : done ? (
          <div className="text-center">
            <p className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4">
              Lozinka je promenjena. ✅
            </p>

            <Link
              to="/login"
              className="inline-block mt-6 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold"
            >
              Prijavi se
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {field(password, setPassword, "Nova lozinka (najmanje 6 znakova)")}
            {field(confirm, setConfirm, "Ponovi novu lozinku")}

            {error && (
              <p className="text-red-600 text-sm">
                {error}{" "}
                {error.includes("istekao") && (
                  <Link to="/forgot-password" className="underline">
                    Zatraži novi link
                  </Link>
                )}
              </p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition"
            >
              {sending ? "Čuvam..." : "Sačuvaj lozinku"}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

export default ResetPassword;
