const { HttpError } = require("./http");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// ?page=2&limit=20 -> { page, limit, offset }. Bez parametara: prva strana od 20.
const parsePage = (query = {}, defaultLimit = DEFAULT_LIMIT) => {
  const page = query.page === undefined || query.page === "" ? 1 : Number(query.page);
  const limit = query.limit === undefined || query.limit === "" ? defaultLimit : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    throw new HttpError(400, "Neispravna strana.");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new HttpError(400, `Na jednoj strani može biti od 1 do ${MAX_LIMIT} stavki.`);
  }

  return { page, limit, offset: (page - 1) * limit };
};

// Polja odgovora za stranu; total je ukupan broj stavki za izabrane filtere
const pageInfo = ({ page, limit }, total) => ({
  total,
  page,
  limit,
  has_more: page * limit < total,
});

module.exports = {
  MAX_LIMIT,
  parsePage,
  pageInfo,
};
