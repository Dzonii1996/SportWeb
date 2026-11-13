import { useCallback, useEffect, useState } from "react";
import { Images } from "lucide-react";
import { useTranslation } from "react-i18next";
import { API_URL } from "../config";
import LoadMore from "../components/LoadMore";
import { Lightbox, PhotoGrid, PhotoSource } from "../components/PhotoGallery";

const PAGE_SIZE = 24;

// Najnovije fotografije sa turnira i javnih termina
function Gallery() {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  const load = useCallback(async (nextPage) => {
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/photos?page=${nextPage}&limit=${PAGE_SIZE}`);
      const body = await res.json();

      if (body.success) {
        setPhotos((prev) => (nextPage === 1 ? body.photos : [...prev, ...body.photos]));
        setHasMore(body.has_more);
        setPage(nextPage);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Images className="text-green-600" size={30} />
            {t("photos.gallery")}
          </h1>
          <p className="text-gray-600 mt-1">{t("photos.gallerySubtitle")}</p>
        </div>

        {photos.length > 0 ? (
          <PhotoGrid
            photos={photos}
            onOpen={setOpen}
            badge={(photo) => (
              <span className="absolute inset-x-0 bottom-0 px-2 pt-6 pb-1.5 text-left text-[11px] sm:text-xs font-medium text-white bg-gradient-to-t from-black/70 to-transparent truncate">
                {photo.tournament_name || photo.match_location}
              </span>
            )}
          />
        ) : (
          !loading && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
              {t("photos.emptyGallery")}
            </div>
          )
        )}

        {hasMore && <LoadMore onClick={() => load(page + 1)} loading={loading} />}
      </div>

      {open !== null && photos[open] && (
        <Lightbox
          photos={photos}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          actions={(photo) => (
            <PhotoSource
              photo={photo}
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
            />
          )}
        />
      )}
    </div>
  );
}

export default Gallery;
