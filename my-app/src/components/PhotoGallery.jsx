import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Flag, ImagePlus, Images, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";

export const photoUrl = (path) => `${API_URL}${path}`;

// Slika preko celog ekrana: strelice (i tasteri ← →) listaju, Esc zatvara.
// actions(photo) vraća dugmad za tu sliku (brisanje, prijava, link na turnir).
export function Lightbox({ photos, index, onIndex, onClose, actions }) {
  const { t } = useTranslation();
  const photo = photos[index];
  const count = photos.length;

  const go = useCallback((step) => onIndex((index + step + count) % count), [index, count, onIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    const overflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [go, onClose]);

  // Prevlačenje prstom levo-desno na telefonu
  const touch = useRef(null);
  const onTouchStart = (e) => {
    touch.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touch.current === null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touch.current = null;
  };

  if (!photo) return null;

  const arrow =
    "absolute top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-neutral-950 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={t("photos.title")}
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white/80 text-sm" onClick={(e) => e.stopPropagation()}>
        <span>
          {index + 1} / {count}
        </span>
        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label={t("photos.close")}>
          <X size={22} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-20">
          <img
            key={photo.id}
            src={photoUrl(photo.path)}
            alt={photo.caption || t("photos.title")}
            className="max-h-full max-w-full object-contain rounded-lg select-none"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {count > 1 && (
          <>
            <button type="button" className={`${arrow} left-2 sm:left-4`} onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label={t("photos.prev")}>
              <ChevronLeft size={26} />
            </button>
            <button type="button" className={`${arrow} right-2 sm:right-4`} onClick={(e) => { e.stopPropagation(); go(1); }} aria-label={t("photos.next")}>
              <ChevronRight size={26} />
            </button>
          </>
        )}
      </div>

      <div className="px-4 py-3 text-white space-y-2 max-w-3xl w-full mx-auto" onClick={(e) => e.stopPropagation()}>
        {photo.caption && <p className="font-medium">{photo.caption}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/70">
          <span>{photo.user_name ? t("photos.by", { name: photo.user_name }) : ""}</span>
          <div className="flex flex-wrap items-center gap-2">{actions?.(photo)}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Mreža sličica; klik otvara sliku preko celog ekrana
export function PhotoGrid({ photos, onOpen, badge }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
      {photos.map((photo, i) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen(i)}
          className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 group focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        >
          <img
            src={photoUrl(photo.thumb_path)}
            alt={photo.caption || t("photos.title")}
            loading="lazy"
            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
          />
          {badge?.(photo)}
        </button>
      ))}
    </div>
  );
}

const actionButton = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white";

// Fotografije turnira (kind="tournaments") ili termina (kind="matches")
function PhotoGallery({ kind, id, linkKey, className = "" }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const input = useRef(null);

  const base = `${API_URL}/api/${kind}/${id}/photos`;
  const query = linkKey ? `?key=${encodeURIComponent(linkKey)}` : "";

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${base}${query}`, { headers: authHeader() });
      const body = await res.json();

      if (body.success) setData(body);
    } catch {
      // Galerija nije bitna za ostatak stranice
    }
  }, [base, query]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return null;

  const { photos, can_upload: canUpload, max_upload: maxUpload } = data;

  // Ako nema slika i korisnik ne može da ih doda, odeljak se ne prikazuje
  if (photos.length === 0 && !canUpload) return null;

  const choose = (e) => {
    const list = [...e.target.files];

    setError(list.length > maxUpload ? t("photos.tooMany", { n: maxUpload }) : "");
    setFiles(list.slice(0, maxUpload));
  };

  const send = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;

    const form = new FormData();
    files.forEach((f) => form.append("photos", f));
    if (caption.trim()) form.append("caption", caption.trim());

    setBusy(true);
    setError("");

    try {
      const res = await fetch(`${base}${query}`, { method: "POST", headers: authHeader(), body: form });
      const body = await res.json();

      if (!body.success) {
        setError(body.message);
        return;
      }

      setFiles([]);
      setCaption("");
      if (input.current) input.current.value = "";
      await load();
    } catch {
      setError(t("photos.uploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photo) => {
    if (!window.confirm(t("photos.confirmDelete"))) return;

    const res = await fetch(`${API_URL}/api/photos/${photo.id}`, { method: "DELETE", headers: authHeader() });
    const body = await res.json();

    if (!body.success) {
      alert(body.message);
      return;
    }

    const left = photos.length - 1;
    setOpen(left === 0 ? null : Math.min(open, left - 1));
    await load();
  };

  const report = async (photo, reason) => {
    const res = await fetch(`${API_URL}/api/photos/${photo.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ reason }),
    });
    const body = await res.json();

    setReporting(false);
    alert(body.message);
  };

  const loggedIn = Boolean(authHeader().Authorization);

  const actions = (photo) => (
    <>
      {loggedIn && !reporting && (
        <button type="button" className={actionButton} onClick={() => setReporting(true)}>
          <Flag size={15} />
          {t("photos.report")}
        </button>
      )}
      {reporting && (
        <>
          <button type="button" className={actionButton} onClick={() => report(photo, "me")}>
            {t("photos.reportMe")}
          </button>
          <button type="button" className={actionButton} onClick={() => report(photo, "inappropriate")}>
            {t("photos.reportInappropriate")}
          </button>
          <button type="button" className={actionButton} onClick={() => setReporting(false)} aria-label={t("photos.close")}>
            <X size={15} />
          </button>
        </>
      )}
      {photo.can_delete && (
        <button type="button" className={`${actionButton} hover:bg-red-500/80`} onClick={() => remove(photo)}>
          <Trash2 size={15} />
          {t("photos.delete")}
        </button>
      )}
    </>
  );

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Images className="text-green-600" size={24} />
          {t("photos.title")}
          {photos.length > 0 && <span className="text-base font-medium text-gray-400">{photos.length}</span>}
        </h2>
      </div>

      {photos.length > 0 ? (
        <PhotoGrid
          photos={photos}
          onOpen={setOpen}
          badge={(photo) =>
            photo.reports > 0 && (
              <span className="absolute top-1.5 left-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-red-600 text-white">
                {t("photos.reports", { n: photo.reports })}
              </span>
            )
          }
        />
      ) : (
        <p className="text-gray-500">{t("photos.empty")}</p>
      )}

      {canUpload && (
        <form onSubmit={send} className="border-t pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-green-300 text-green-700 font-semibold cursor-pointer hover:bg-green-50">
              <ImagePlus size={18} />
              {t("photos.choose")}
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={choose} className="sr-only" />
            </label>
            {files.length > 0 && <span className="text-sm text-gray-600">{t("photos.selected", { n: files.length })}</span>}
          </div>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={200}
                placeholder={t("photos.captionPlaceholder")}
                className="flex-1 min-w-[12rem] border p-2.5 rounded-xl"
              />
              <button type="submit" disabled={busy} className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl font-semibold">
                {busy ? t("photos.uploading") : t("photos.add")}
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-gray-500">{t("photos.hint", { n: maxUpload })}</p>
        </form>
      )}

      {open !== null && photos[open] && (
        <Lightbox
          photos={photos}
          index={open}
          onIndex={(i) => { setOpen(i); setReporting(false); }}
          onClose={() => { setOpen(null); setReporting(false); }}
          actions={actions}
        />
      )}
    </div>
  );
}

// Link iz galerije na turnir ili termin sa kog je slika
export function PhotoSource({ photo, className = "" }) {
  const { t } = useTranslation();

  if (photo.tournament_id) {
    return (
      <Link to={`/turniri/${photo.tournament_id}`} className={className}>
        {t("photos.fromTournament", { name: photo.tournament_name })}
      </Link>
    );
  }

  return (
    <Link to={`/matches/${photo.match_id}`} className={className}>
      {t("photos.fromMatch", { place: photo.match_location })}
    </Link>
  );
}

export default PhotoGallery;
