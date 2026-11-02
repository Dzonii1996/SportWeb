import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { API_URL } from "../config";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      setMessage(data.message);

    } catch (error) {
      console.error(error);
      setMessage("Greška pri povezivanju sa serverom.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-600 to-green-800 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Zaboravljena lozinka 🔑
          </h1>
          <p className="text-gray-500 mt-2">
            Unesi email naloga i poslaćemo ti link za novu lozinku.
          </p>
        </div>

        {message ? (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-center">
            {message}
            <p className="text-sm text-green-700 mt-2">
              Proveri i spam folder. Link važi sat vremena.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center border rounded-xl px-3">
              <Mail className="text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Unesite email"
                className="w-full p-3 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition"
            >
              {sending ? "Šaljem..." : "Pošalji link"}
            </button>
          </form>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="text-green-600 font-semibold hover:underline">
            Nazad na prijavu
          </Link>
        </div>

      </div>
    </div>
  );
}

export default ForgotPassword;
