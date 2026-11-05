import { Link, NavLink, useLocation } from "react-router-dom";
import { CalendarDays, Home, MapPin, Plus, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

// Na ovim stranicama korisnik se tek prijavljuje, pa navigacija samo smeta
const HIDDEN_ON = ["/login", "/register", "/forgot-password", "/reset-password"];

const tabClass = ({ isActive }) =>
  `flex flex-col items-center justify-center gap-0.5 min-w-0 text-[11px] font-semibold transition ${
    isActive ? "text-green-700" : "text-gray-500"
  }`;

// Donja navigacija na telefonu; ostale stranice su u meniju gore desno
function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  if (HIDDEN_ON.includes(pathname)) return null;

  const tab = (to, Icon, label, end = false) => (
    <NavLink to={to} end={end} className={tabClass}>
      <Icon size={22} aria-hidden="true" />
      <span className="truncate max-w-full">{label}</span>
    </NavLink>
  );

  return (
    <>
      {/* Prostor da traka ne prekrije kraj stranice */}
      <div className="h-20 md:hidden" aria-hidden="true" />

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 font-display"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5 h-16 px-1">
          {tab("/", Home, t("nav.home"), true)}
          {tab("/matches", CalendarDays, t("nav.games"))}

          <div className="flex items-center justify-center">
            <Link
              to="/create-match"
              aria-label={t("common.createGame")}
              title={t("common.createGame")}
              className="w-12 h-12 -mt-5 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow-lg ring-4 ring-white transition"
            >
              <Plus size={26} aria-hidden="true" />
            </Link>
          </div>

          {tab("/tereni", MapPin, t("nav.venues"))}
          {tab("/turniri", Trophy, t("common.tournaments"))}
        </div>
      </nav>
    </>
  );
}

export default BottomNav;
