import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Menu, X, Plus, ChevronDown, User, CalendarCheck, CalendarClock, LogOut } from "lucide-react";
import { logout } from "../utils/auth";
import LanguageSwitcher from "../components/LanguageSwitcher";
import NotificationBell from "../components/NotificationBell";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

const LINKS = [
  { to: "/", get label() { return i18n.t("nav.home"); }, end: true },
  { to: "/matches", get label() { return i18n.t("nav.games"); } },
  { to: "/tereni", get label() { return i18n.t("nav.venues"); } },
  { to: "/turniri", get label() { return i18n.t("common.tournaments"); } },
  { to: "/rang-lista", get label() { return i18n.t("common.leaderboard"); } },
];

const USER_LINKS = [
  { to: "/my-matches", get label() { return i18n.t("common.myGames"); } },
];

// Aktivni link dobija zelenu pozadinu
const linkClass = ({ isActive }) =>
  `px-3 py-2 rounded-full font-medium whitespace-nowrap transition ${
    isActive
      ? "bg-green-50 text-green-700"
      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
  }`;

const mobileLinkClass = ({ isActive }) =>
  `block px-4 py-3 rounded-xl font-medium ${
    isActive ? "bg-green-50 text-green-700" : "text-gray-700 hover:bg-gray-100"
  }`;

function Navbar() {
  const { t } = useTranslation();


  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef(null);

useEffect(() => {

  const loadUser = () => {
    const loggedUser = localStorage.getItem("user");

    if (loggedUser) {
      setUser(JSON.parse(loggedUser));
    } else {
      setUser(null);
    }
  };

  loadUser();

  window.addEventListener("storage", loadUser);

  return () => {
    window.removeEventListener("storage", loadUser);
  };

}, []);

  // Promena stranice zatvara oba menija
  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  // Klik van korisničkog menija ga zatvara
  useEffect(() => {
    if (!menuOpen) return;

    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleLogout = () => {
    logout();

    navigate("/login");
  };

  const initial = user?.name?.charAt(0).toUpperCase();

  return (
    <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 text-white flex items-center justify-center text-lg shadow-sm">
            ⚽
          </span>
          <span className="text-xl font-extrabold tracking-tight text-gray-900">
            Sport<span className="text-green-600">Web</span>
          </span>
        </Link>

        {/* Linkovi (desktop, od lg) */}
        <div className="hidden lg:flex items-center gap-1">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}

          {/* Na užem ekranu su u korisničkom meniju */}
          {user && USER_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={(state) => `${linkClass(state)} hidden xl:block`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Desna strana */}
        <div className="flex items-center gap-2">

          <LanguageSwitcher className="hidden lg:inline-flex" />

          {user ? (
            <>
              <Link
                to="/create-match"
                aria-label={t("common.createGame")}
                title={t("common.createGame")}
                className="hidden sm:inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full font-semibold shadow-sm whitespace-nowrap transition"
              >
                <Plus size={18} />
                {/* Na lg nema mesta za tekst pored linkova i izbora jezika */}
                <span className="lg:hidden xl:inline">{t("common.createGame")}</span>
              </Link>

              <NotificationBell key={user.id} userId={user.id} />

              {/* Korisnički meni (desktop, od lg) */}
              <div className="relative hidden lg:block" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100 transition"
                >
                  <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                    {initial}
                  </span>
                  <span className="hidden xl:inline font-medium text-gray-800 max-w-[8rem] truncate">
                    {user.name}
                  </span>
                  <ChevronDown size={16} className="text-gray-500" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border py-2">
                    <Link
                      to="/profile"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
                    >
                      <User size={18} className="text-gray-500" />
                      {t("common.myProfile")}
                    </Link>

                    <Link
                      to="/my-matches"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
                    >
                      <CalendarCheck size={18} className="text-gray-500" />
                      {t("common.myGames")}
                    </Link>

                    <Link
                      to="/rezervacije"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
                    >
                      <CalendarClock size={18} className="text-gray-500" />
                      {t("common.bookings")}
                    </Link>

                    <div className="my-1 border-t" />

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={18} />
                      {t("common.signOut")}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="hidden lg:flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 rounded-full font-medium text-gray-700 hover:bg-gray-100"
              >
                {t("nav.signIn")}
              </Link>

              <Link
                to="/register"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full font-semibold shadow-sm transition"
              >
                {t("nav.signUp")}
              </Link>
            </div>
          )}

          {/* Dugme za mobilni meni */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-full hover:bg-gray-100"
            aria-label={t("nav.menu")}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

        </div>

      </div>

      {/* Mobilni meni */}
      {mobileOpen && (
        <div className="lg:hidden border-t bg-white px-4 py-3 space-y-1">

          <div className="flex items-center justify-between px-4 py-2">
            <span className="font-medium text-gray-700">{t("nav.language")}</span>
            <LanguageSwitcher />
          </div>

          {user && (
            <div className="flex items-center gap-3 px-4 py-3 mb-1">
              <span className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-lg">
                {initial}
              </span>
              <span className="font-semibold">{user.name}</span>
            </div>
          )}

          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={mobileLinkClass}>
              {l.label}
            </NavLink>
          ))}

          {user ? (
            <>
              <NavLink to="/my-matches" className={mobileLinkClass}>
                {t("common.myGames")}
              </NavLink>

              <NavLink to="/rezervacije" className={mobileLinkClass}>
                {t("common.bookings")}
              </NavLink>

              <NavLink to="/profile" className={mobileLinkClass}>
                {t("common.myProfile")}
              </NavLink>

              <Link
                to="/create-match"
                className="flex items-center justify-center gap-1.5 mt-2 bg-green-600 text-white px-4 py-3 rounded-xl font-semibold"
              >
                <Plus size={18} />
                {t("common.createGame")}
              </Link>

              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 rounded-xl font-medium text-red-600 hover:bg-red-50"
              >
                {t("common.signOut")}
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link
                to="/login"
                className="text-center px-4 py-3 rounded-xl font-medium border"
              >
                {t("nav.signIn")}
              </Link>

              <Link
                to="/register"
                className="text-center bg-green-600 text-white px-4 py-3 rounded-xl font-semibold"
              >
                {t("nav.signUp")}
              </Link>
            </div>
          )}

        </div>
      )}

    </nav>
  );
}

export default Navbar;
