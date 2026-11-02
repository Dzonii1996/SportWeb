import axios from "axios";

// Header sa JWT tokenom za zaštićene rute na serveru
export const authHeader = () => {
  const token = localStorage.getItem("token");

  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  // "storage" se ne okida u istom tabu, pa javljamo NavBar-u ručno
  window.dispatchEvent(new Event("storage"));
};

// Čita "exp" iz tokena (sekunde od 1970) i poredi sa trenutnim vremenom
const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );

    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

const logoutAndRedirect = () => {
  logout();

  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
};

// Poziva se jednom pri pokretanju aplikacije
export const setupAuth = () => {
  const token = localStorage.getItem("token");

  // Istekao token: odjavi odmah, da NavBar ne prikazuje korisnika
  if (token && isTokenExpired(token)) {
    logout();
  }

  // Svaki 401 sa servera znači da sesija više ne važi
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const res = await originalFetch(...args);

    if (res.status === 401 && localStorage.getItem("token")) {
      logoutAndRedirect();
    }

    return res;
  };

  axios.interceptors.response.use(
    (res) => res,
    (error) => {
      if (
        error.response?.status === 401 &&
        localStorage.getItem("token")
      ) {
        logoutAndRedirect();
      }

      return Promise.reject(error);
    }
  );
};
