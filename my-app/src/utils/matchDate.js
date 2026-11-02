// match_date stiže iz baze kao UTC (npr. "2026-08-09T22:00:00Z" za 10. 8.),
// pa datum uvek računamo po lokalnom vremenu, a ne sa .slice(0, 10)

// "YYYY-MM-DD" po lokalnom vremenu, isti format kao <input type="date">
export const localDateKey = (matchDate) => {
  const d = new Date(matchDate);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Granice za <input type="date"> pri kreiranju i izmeni (isto proverava server)
export const todayKey = () => localDateKey(new Date());

export const maxDateKey = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);

  return localDateKey(d);
};

// Tačan početak termina: datum + vreme ("20:30:00")
export const matchStart = (matchDate, matchTime) => {
  const d = new Date(matchDate);
  const [h = 0, m = 0] = (matchTime || "").split(":").map(Number);

  d.setHours(h, m, 0, 0);

  return d;
};

export const isPastMatch = (matchDate, matchTime) =>
  matchStart(matchDate, matchTime) < new Date();

// Za pretragu bez obzira na velika slova i kvačice (š, č, ć, ž, đ)
export const normalizeText = (text) =>
  (text || "")
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
