import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

function Navbar() {

  const navigate = useNavigate();

  const [user, setUser] = useState(null);

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
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);

    navigate("/login");
  };

  return (
    <nav className="bg-white shadow-md">

      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">

        <Link
          to="/"
          className="text-2xl font-bold text-green-600"
        >
          SportWeb
        </Link>

        <div className="flex items-center gap-6">

          <Link
            to="/"
            className="hover:text-green-600"
          >
            Početna
          </Link>

          <Link
            to="/matches"
            className="hover:text-green-600"
          >
            Termini
          </Link>

          {user ? (
            <>
              <Link
                to="/create-match"
                className="hover:text-green-600"
              >
                Kreiraj termin
              </Link>
              <Link to="/my-matches">Moji termini</Link>

              <Link
                to="/profile"
                className="hover:text-green-600 font-semibold"
              >
                {user.name}
              </Link>

              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hover:text-green-600"
              >
                Login
              </Link>

              <Link
                to="/register"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Registracija
              </Link>
            </>
          )}

        </div>

      </div>

    </nav>
  );
}

export default Navbar;