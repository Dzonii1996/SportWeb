import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { Stars, StarInput } from "./Stars";

const MAX_COMMENT = 1000;

// "1 ocena", "3 ocene", "5 ocena", "22 ocene"
const ratingsLabel = (n) =>
  [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "ocene" : "ocena";

// Ocene terena: prosek i raspodela, moja ocena (forma) i lista ocena.
// onChange se zove posle izmene, da stranica osveži prosek u zaglavlju.
function VenueReviews({ venueId, onChange }) {
  const loggedIn = Boolean(localStorage.getItem("token"));
  const me = JSON.parse(localStorage.getItem("user") || "null");

  const [data, setData] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`${API_URL}/api/venues/${venueId}/reviews`, { headers: authHeader() })
      .then((res) => res.json())
      .then((result) => {
        if (!result.success) return;

        setData(result);
        setRating(result.my_review?.rating || 0);
        setComment(result.my_review?.comment || "");
        setEditing(false);
      })
      .catch((error) => console.error(error));
  }, [venueId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();

    if (!rating) {
      alert("Izaberi ocenu (broj zvezdica).");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/reviews`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ rating, comment }),
      });
      const result = await res.json();

      if (!result.success) {
        alert(result.message);
        return;
      }

      load();
      onChange?.();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (review) => {
    const own = Number(review.user_id) === Number(me?.id);

    if (!window.confirm(own ? "Obrisati tvoju ocenu?" : `Obrisati ocenu korisnika ${review.user_name}?`)) {
      return;
    }

    const res = await fetch(`${API_URL}/api/venues/${venueId}/reviews/${review.id}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    const result = await res.json();

    if (!result.success) {
      alert(result.message);
      return;
    }

    load();
    onChange?.();
  };

  if (!data) return null;

  const { reviews, distribution, my_review: myReview, can_moderate: canModerate } = data;
  const total = reviews.length;
  const avg = total ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
  const showForm = loggedIn && (!myReview || editing);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
      <h2 className="text-2xl font-bold">Ocene terena</h2>

      {/* Prosek i raspodela po zvezdicama */}
      {total > 0 ? (
        <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
          <div className="text-center sm:w-40 shrink-0">
            <p className="text-5xl font-extrabold">
              {avg.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
            </p>
            <Stars value={avg} size={20} />
            <p className="text-sm text-gray-500 mt-1">
              {total} {ratingsLabel(total)}
            </p>
          </div>

          <div className="flex-1 space-y-1.5">
            {distribution.map(({ stars, count }) => (
              <div key={stars} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-right text-gray-600">{stars}</span>
                <span className="text-amber-400">★</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-amber-400 rounded-full"
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-gray-500">{count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-gray-600">Teren još nema ocena. Budi prvi!</p>
      )}

      {/* Moja ocena */}
      {!loggedIn && (
        <p className="text-gray-600">
          <Link to="/login" className="text-green-700 font-semibold hover:underline">
            Prijavi se
          </Link>{" "}
          da oceniš teren.
        </p>
      )}

      {loggedIn && myReview && !editing && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Tvoja ocena:</span>
            <Stars value={myReview.rating} />
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-green-700 font-semibold hover:underline"
          >
            Izmeni
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="space-y-3 border rounded-xl p-4">
          <p className="font-medium">{myReview ? "Izmeni ocenu" : "Oceni teren"}</p>

          <StarInput value={rating} onChange={setRating} />

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={MAX_COMMENT}
            placeholder="Komentar (nije obavezno): podloga, svlačionice, osvetljenje, parking..."
            className="w-full border p-3 rounded-xl"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-5 py-2 rounded-xl font-semibold"
            >
              {saving ? "Čuvam..." : "Sačuvaj ocenu"}
            </button>

            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setRating(myReview.rating);
                  setComment(myReview.comment || "");
                }}
                className="px-5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              >
                Otkaži
              </button>
            )}
          </div>
        </form>
      )}

      {/* Lista ocena */}
      {total > 0 && (
        <ul className="divide-y">
          {reviews.map((review) => {
            const own = Number(review.user_id) === Number(me?.id);

            return (
              <li key={review.id} className="py-4 flex gap-3">
                <Link to={`/users/${review.user_id}`} className="shrink-0">
                  {review.user_avatar ? (
                    <img
                      src={`${API_URL}${review.user_avatar}`}
                      alt={review.user_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                      {review.user_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link to={`/users/${review.user_id}`} className="font-semibold hover:text-green-700">
                      {review.user_name}
                    </Link>

                    {review.played_here && (
                      <span className="text-xs font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                        ✓ igrao/la ovde
                      </span>
                    )}

                    <span className="text-sm text-gray-500">
                      {new Date(review.updated_at).toLocaleDateString("sr-Latn-RS")}
                    </span>

                    {(own || canModerate) && (
                      <button
                        onClick={() => remove(review)}
                        title="Obriši ocenu"
                        aria-label="Obriši ocenu"
                        className="ml-auto p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <Stars value={review.rating} size={14} />

                  {review.comment && (
                    <p className="mt-1 text-gray-700 whitespace-pre-line break-words">{review.comment}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default VenueReviews;
